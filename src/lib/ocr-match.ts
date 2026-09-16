import { supabase } from "@/integrations/supabase/client";
import { enDigits } from "@/lib/fa";
import type { OcrPriceEvent, OcrResult } from "@/lib/ocr.functions";
import {
  addPriceEvent,
  isArchived,
  restoreProperty,
  type Property,
  type PropertyInput,
} from "@/lib/properties";

export type MatchConfidence = "high" | "medium" | "low";

export interface OcrCandidate {
  property: Property;
  score: number;
  confidence: MatchConfidence;
  /** Persian reasons shown in the confirmation dialog. */
  reasons: string[];
}

function norm(value: string | null | undefined): string {
  if (!value) return "";
  return enDigits(String(value))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function digitsOnly(value: string | null | undefined): string {
  return value ? enDigits(String(value)).replace(/\D/g, "") : "";
}

/* --------------------------- Jalali date parsing -------------------------- */

/** Jalali (۱۴۰۵/۰۶/۱۷) → ISO timestamp. Returns null when unparsable. */
export function jalaliToISO(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = enDigits(String(text)).match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (!m) return null;
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  if (jy > 1600) {
    // Already Gregorian.
    const date = new Date(Date.UTC(jy, jm - 1, jd));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  // Days since the Jalali epoch, converted through the Julian Day Number.
  const jy1 = jy - 979;
  const jDayNo =
    365 * jy1 +
    Math.floor(jy1 / 33) * 8 +
    Math.floor(((jy1 % 33) + 3) / 4) +
    (jm < 7 ? (jm - 1) * 31 : 186 + (jm - 7) * 30) +
    (jd - 1);
  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400 * Math.floor(gDayNo / 146097);
  gDayNo %= 146097;
  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo--;
    gy += 100 * Math.floor(gDayNo / 36524);
    gDayNo %= 36524;
    if (gDayNo >= 365) gDayNo++;
    else leap = false;
  }
  gy += 4 * Math.floor(gDayNo / 1461);
  gDayNo %= 1461;
  if (gDayNo >= 366) {
    leap = false;
    gDayNo--;
    gy += Math.floor(gDayNo / 365);
    gDayNo %= 365;
  }
  const monthDays = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  while (gm < 12 && gDayNo >= monthDays[gm]!) {
    gDayNo -= monthDays[gm]!;
    gm++;
  }
  const date = new Date(Date.UTC(gy, gm, gDayNo + 1));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/* ------------------------------ candidates ------------------------------- */

const CANDIDATE_LIMIT = 15;

/**
 * Finds the few files an OCR reading may belong to. Only narrow, indexed
 * lookups run — never a full table read — so this stays usable with tens of
 * thousands of files. Price and price date are deliberately NOT used as
 * matching signals: prices change over time and belong to the price history.
 */
export async function findOcrCandidates(result: OcrResult): Promise<OcrCandidate[]> {
  const found = new Map<string, Property>();

  const collect = async (build: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const { data, error } = await build();
    if (error) return;
    for (const row of (data ?? []) as Property[]) found.set(row.id, row);
  };

  // 1) File code — the strongest, single-row lookup.
  if (result.file_code) {
    await collect(() =>
      supabase.from("properties").select("*").eq("file_code", result.file_code!).limit(1),
    );
  }

  // 2) Owner phone — unique in practice.
  const phone = digitsOnly(result.owner_phone);
  if (phone.length >= 7) {
    await collect(() =>
      supabase
        .from("properties")
        .select("*")
        .ilike("owner_phone", `%${phone.slice(-9)}%`)
        .limit(CANDIDATE_LIMIT),
    );
  }

  // 3) Plot number.
  if (result.plot_number) {
    await collect(() =>
      supabase
        .from("properties")
        .select("*")
        .ilike("plot_number", `%${enDigits(result.plot_number!).trim()}%`)
        .limit(CANDIDATE_LIMIT),
    );
  }

  // 4) Location + area window (±3%).
  if (result.area && (result.neighborhood || result.phase)) {
    await collect(() => {
      let query = supabase
        .from("properties")
        .select("*")
        .gte("area", Math.floor(result.area! * 0.97))
        .lte("area", Math.ceil(result.area! * 1.03));
      if (result.neighborhood) query = query.ilike("neighborhood", `%${result.neighborhood}%`);
      else if (result.phase) query = query.eq("phase", result.phase);
      return query.limit(CANDIDATE_LIMIT);
    });
  }

  // 5) Title / street text.
  const titleText = norm(result.title).split(" ").slice(0, 3).join(" ");
  if (titleText.length >= 4) {
    await collect(() =>
      supabase.from("properties").select("*").ilike("title", `%${titleText}%`).limit(CANDIDATE_LIMIT),
    );
  }

  // 6) Street / address text — a sheet often names only the street.
  const street = norm(result.street) || norm(result.address).split(" ").slice(0, 3).join(" ");
  if (street.length >= 3) {
    await collect(() =>
      supabase
        .from("properties")
        .select("*")
        .or(`street.ilike.%${street}%,address.ilike.%${street}%,title.ilike.%${street}%`)
        .limit(CANDIDATE_LIMIT),
    );
  }

  // 7) Area alone (±2%) — narrow and indexed, catches sheets with no location text.
  if (result.area) {
    await collect(() =>
      supabase
        .from("properties")
        .select("*")
        .gte("area", Math.floor(result.area! * 0.98))
        .lte("area", Math.ceil(result.area! * 1.02))
        .limit(CANDIDATE_LIMIT),
    );
  }

  const scored = [...found.values()]
    .map((property) => score(property, result))
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 5);
}

function score(property: Property, result: OcrResult): OcrCandidate {
  const reasons: string[] = [];
  let score = 0;

  if (result.file_code && property.file_code === result.file_code) {
    score += 8;
    reasons.push("کد فایل یکسان");
  }
  const phone = digitsOnly(result.owner_phone);
  const ownerPhone = digitsOnly(property.owner_phone);
  if (phone.length >= 7 && ownerPhone.endsWith(phone.slice(-9))) {
    score += 5;
    reasons.push("شماره مالک یکسان");
  }
  if (result.plot_number && norm(result.plot_number) === norm(property.plot_number)) {
    score += 4;
    reasons.push("پلاک یکسان");
  }
  if (result.owner_name && norm(result.owner_name) === norm(property.owner_name)) {
    score += 2;
    reasons.push("نام مالک یکسان");
  }
  if (result.area && property.area) {
    const diff = Math.abs(result.area - Number(property.area)) / Number(property.area);
    if (diff <= 0.02) {
      score += 3;
      reasons.push("متراژ یکسان");
    }
  }
  if (result.neighborhood && norm(result.neighborhood) === norm(property.neighborhood)) {
    score += 2;
    reasons.push("محله یکسان");
  }
  if (result.phase && norm(result.phase) === norm(property.phase)) {
    score += 1;
    reasons.push("فاز یکسان");
  }
  if (result.street && norm(result.street) === norm(property.street)) {
    score += 1;
    reasons.push("خیابان یکسان");
  }
  const title = norm(result.title);
  if (title.length >= 4 && norm(property.title).includes(title.split(" ").slice(0, 3).join(" "))) {
    score += 2;
    reasons.push("عنوان مشابه");
  }
  if (result.property_type && result.property_type === property.property_type) {
    score += 1;
    reasons.push("نوع ملک یکسان");
  }

  const confidence: MatchConfidence = score >= 8 ? "high" : score >= 5 ? "medium" : "low";
  return { property, score, confidence, reasons };
}

export const CONFIDENCE_LABELS: Record<MatchConfidence, string> = {
  high: "اطمینان بالا",
  medium: "اطمینان متوسط",
  low: "اطمینان کم",
};

/* ------------------------------- applying -------------------------------- */

/** Fields OCR may fill on an existing file when they are still empty. */
const FILLABLE: (keyof PropertyInput)[] = [
  "plot_number",
  "street",
  "address",
  "neighborhood",
  "phase",
  "owner_name",
  "owner_phone",
  "area",
  "bedrooms",
  "floor",
  "total_floors",
  "building_age",
  "description",
  "notes",
  "land_category",
  "land_zone",
];

export interface FieldChange {
  key: keyof PropertyInput;
  label: string;
  current: string;
  next: string;
  /** A conflict replaces an existing, different value — needs explicit consent. */
  conflict: boolean;
}

const FIELD_LABELS: Partial<Record<keyof PropertyInput, string>> = {
  plot_number: "پلاک",
  street: "خیابان",
  address: "آدرس",
  neighborhood: "محله",
  phase: "فاز",
  owner_name: "نام مالک",
  owner_phone: "شماره مالک",
  area: "متراژ",
  bedrooms: "تعداد خواب",
  floor: "طبقه",
  total_floors: "تعداد طبقات",
  building_age: "سن بنا",
  description: "توضیحات",
  notes: "یادداشت",
  land_category: "دسته زمین",
  land_zone: "محدوده",
};

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && !value.trim());
}

/** What the OCR reading would change on a candidate file. */
export function planChanges(property: Property, result: OcrResult): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const key of FILLABLE) {
    const next = (result as Record<string, unknown>)[key as string];
    if (isEmpty(next)) continue;
    const current = (property as unknown as Record<string, unknown>)[key as string];
    if (!isEmpty(current) && norm(String(current)) === norm(String(next))) continue;
    changes.push({
      key,
      label: FIELD_LABELS[key] ?? String(key),
      current: isEmpty(current) ? "—" : String(current),
      next: String(next),
      conflict: !isEmpty(current),
    });
  }
  return changes;
}

/** Every price/date pair the image contained, newest last. */
export function priceEventsOf(result: OcrResult): OcrPriceEvent[] {
  const events = (result.price_events ?? []).filter((event) => Number(event.price) > 0);
  if (events.length) return events;
  if (result.price) return [{ date: null, price: result.price, note: null }];
  return [];
}

/**
 * Links an OCR reading to an EXISTING file: fills accepted fields, records every
 * price reading as a history event and never deletes existing information. The
 * file keeps its own file code.
 */
export async function linkOcrToProperty(options: {
  property: Property;
  result: OcrResult;
  accepted: FieldChange[];
  userId: string;
  /** Treat the newest read price as the confirmed current price. */
  verifyPrice: boolean;
  restore: boolean;
}): Promise<{ fields: number; events: number }> {
  const { property, result, accepted, userId } = options;

  const patch: Record<string, unknown> = {};
  for (const change of accepted) patch[change.key as string] = change.next;
  if (Object.keys(patch).length) {
    const { error } = await supabase
      .from("properties")
      .update(patch as never)
      .eq("id", property.id);
    if (error) throw error;
  }

  const events = priceEventsOf(result).slice().sort((a, b) => {
    const at = jalaliToISO(a.date ?? null) ?? "";
    const bt = jalaliToISO(b.date ?? null) ?? "";
    return at.localeCompare(bt);
  });
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    const isNewest = index === events.length - 1;
    await addPriceEvent({ ...property, ...(patch as Partial<Property>) } as Property, userId, {
      price: event.price ?? null,
      event_at: jalaliToISO(event.date ?? null),
      source: "ocr",
      confidence: isNewest && options.verifyPrice ? "confirmed" : "ocr",
      note: event.note ?? "ثبت از تصویر (OCR)",
      verify: isNewest ? options.verifyPrice : false,
    });
  }

  if (options.restore && isArchived(property)) await restoreProperty(property.id);

  return { fields: Object.keys(patch).length, events: events.length };
}
