/**
 * Land categories (دسته) and their zones (محدوده).
 *
 * Extensible by design: add a zone to `zones` (or a whole new category) and the
 * form, filters, smart search and OCR matching pick it up automatically — no
 * other logic needs to change. Apartment-land categories intentionally have an
 * empty zone list for now.
 *
 * `id` values are stored in the database, so never rename an existing id.
 */
export interface LandZone {
  /** Canonical Persian label — this exact string is stored in `land_zone`. */
  label: string;
  /** Extra spellings used by OCR / smart-search matching. */
  aliases?: string[];
}

export interface LandCategory {
  id: string;
  label: string;
  aliases?: string[];
  zones: LandZone[];
}

const z = (label: string, ...aliases: string[]): LandZone => ({ label, aliases });

export const LAND_CATEGORIES: LandCategory[] = [
  {
    id: "baghshahri",
    label: "باغشهری",
    aliases: ["باغشهری", "باغشهر", "باغ شهری", "باغ شهر"],
    zones: [
      z("گلبهار"),
      z("پردیس"),
      z("بهارستان"),
      z("دادگستری قدیم"),
      z("دادگستری جدید فاز ۱", "دادگستری جدید فاز 1"),
      z("دادگستری جدید فاز ۲", "دادگستری جدید فاز 2"),
      z("دادگستری جدید فاز ۳", "دادگستری جدید فاز 3"),
      z("آموزش و پرورش", "اموزش و پرورش"),
      z("شهرداری"),
      z("اهل‌بیت", "اهل بیت", "اهلبیت"),
      z("قصر سبز"),
      z("زاگرس"),
    ],
  },
  {
    id: "residential_phase_1",
    label: "زمین مسکونی فاز ۱",
    aliases: ["زمین مسکونی فاز 1", "مسکونی فاز 1"],
    zones: [
      z("زمین پاسارگاد", "پاسارگاد"),
      z("زمین بوستان", "بوستان"),
      z("زمین مولانا (ملکی)", "مولانا ملکی"),
      z("زمین مولانا (اوقاف)", "مولانا اوقاف"),
      z("زمین دانش", "دانش"),
      z("زمین ایران", "ایران"),
      z("زمین نیروانتظامی فاز ۱", "نیروانتظامی فاز 1", "نیرو انتظامی فاز 1"),
      z("زمین کوهسار", "کوهسار"),
      z("زمین زعفرانیه", "زعفرانیه"),
      z("زمین دادگستری سعدی", "دادگستری سعدی"),
      z("زمین اساتید قدیم و جدید", "اساتید"),
      z("زمین البرز ۱", "البرز 1"),
      z("زمین البرز ۲ (فارابی)", "البرز 2", "فارابی"),
      z("زمین البرز ۳", "البرز 3"),
      z("زمین البرز ۵", "البرز 5"),
      z("زمین البرز ۷", "البرز 7"),
      z("زمین ۸۰ هکتاری و ۳۲ هکتاری", "80 هکتاری", "32 هکتاری"),
      z("زمین توحیدیان ۱ و ۲", "توحیدیان"),
    ],
  },
  {
    id: "residential_phase_2",
    label: "زمین مسکونی فاز ۲",
    aliases: ["زمین مسکونی فاز 2", "مسکونی فاز 2"],
    zones: [
      z("زون"),
      z("نیروانتظامی فاز ۲", "نیروانتظامی فاز 2", "نیرو انتظامی فاز 2"),
      z("علوم پزشکی"),
      z("۱۱۵ هکتاری", "115 هکتاری"),
      z("ارتش جدید"),
      z("۲۶ هکتاری", "26 هکتاری"),
      z("نادر محمدی"),
      z("۲۸ هکتاری", "28 هکتاری"),
      z("کاشی حافظ"),
      z("ارتش قدیم"),
      z("مخابرات ۱", "مخابرات 1"),
      z("مخابرات ۲", "مخابرات 2"),
      z("زمزم"),
      z("هنرستان"),
      z("جهاد"),
      z("تربیت بدنی"),
      z("زمین شهری"),
      z("امور عشایر و تعاون", "امور عشایر", "عشایر و تعاون"),
      z("هلال احمر"),
      z("کشاورزی"),
      z("زمین ندسا", "ندسا"),
      z("زمین هوابرد", "هوابرد"),
    ],
  },
  { id: "apartment_phase_1", label: "زمین آپارتمانی فاز ۱", aliases: ["زمین اپارتمانی فاز 1", "آپارتمانی فاز 1", "اپارتمانی فاز 1"], zones: [] },
  { id: "apartment_phase_2", label: "زمین آپارتمانی فاز ۲", aliases: ["زمین اپارتمانی فاز 2", "آپارتمانی فاز 2", "اپارتمانی فاز 2"], zones: [] },
];

export const LAND_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  LAND_CATEGORIES.map((item) => [item.id, item.label]),
);

export function landCategory(id: string | null | undefined): LandCategory | null {
  if (!id) return null;
  return LAND_CATEGORIES.find((item) => item.id === id) ?? null;
}

export function zonesFor(id: string | null | undefined): LandZone[] {
  return landCategory(id)?.zones ?? [];
}

/** Category that owns a given zone label (used for legacy/manual fill-in). */
export function categoryOfZone(zoneLabel: string | null | undefined): LandCategory | null {
  if (!zoneLabel) return null;
  const target = normalizeFa(zoneLabel);
  return (
    LAND_CATEGORIES.find((cat) =>
      cat.zones.some((zone) => normalizeFa(zone.label) === target),
    ) ?? null
  );
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Digit/letter/spacing tolerant normalization for Persian matching. */
export function normalizeFa(text: string): string {
  return text
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/\u200c/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasRegex(alias: string): RegExp {
  const tokens = normalizeFa(alias)
    .split(" ")
    .filter(Boolean)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return /$^/;
  return new RegExp(`(?:^|[\\s،.,/\\-])${tokens.join("\\s*")}(?:$|[\\s،.,/\\-])`);
}

function aliasesOf(zone: LandZone): string[] {
  return [zone.label, ...(zone.aliases ?? [])];
}

export interface LandMatch {
  land_category: string | null;
  land_zone: string | null;
  plot_number: string | null;
}

/**
 * Confidence-first matcher. Returns nulls instead of guessing:
 * an ambiguous zone (two equally good candidates) yields `null`.
 */
export function detectLand(rawText: string): LandMatch {
  const text = ` ${normalizeFa(rawText)} `;

  let bestZone: { category: LandCategory; zone: LandZone; length: number } | null = null;
  let ambiguous = false;

  for (const category of LAND_CATEGORIES) {
    for (const zone of category.zones) {
      let matchedLength = 0;
      for (const alias of aliasesOf(zone)) {
        const normalized = normalizeFa(alias);
        if (aliasRegex(alias).test(text)) {
          matchedLength = Math.max(matchedLength, normalized.length);
        }
      }
      if (!matchedLength) continue;
      if (!bestZone || matchedLength > bestZone.length) {
        bestZone = { category, zone, length: matchedLength };
        ambiguous = false;
      } else if (matchedLength === bestZone.length && bestZone.zone.label !== zone.label) {
        ambiguous = true;
      }
    }
  }

  let categoryId: string | null = null;
  let categoryLength = 0;
  let categoryAmbiguous = false;
  for (const category of LAND_CATEGORIES) {
    for (const alias of [category.label, ...(category.aliases ?? [])]) {
      const normalized = normalizeFa(alias);
      if (!aliasRegex(alias).test(text)) continue;
      if (normalized.length > categoryLength) {
        categoryId = category.id;
        categoryLength = normalized.length;
        categoryAmbiguous = false;
      } else if (normalized.length === categoryLength && categoryId !== category.id) {
        categoryAmbiguous = true;
      }
    }
  }
  if (categoryAmbiguous) categoryId = null;

  const zoneMatch = bestZone && !ambiguous ? bestZone : null;
  // An explicit category wins; otherwise infer it from a confident zone match.
  const finalCategory = categoryId ?? zoneMatch?.category.id ?? null;
  const finalZone =
    zoneMatch && (!finalCategory || zoneMatch.category.id === finalCategory)
      ? zoneMatch.zone.label
      : null;

  const plotMatch = text.match(/پلاک\s*([0-9]+(?:\s*\/\s*[^\s،.]+)?(?:\s*فرعی)?|[^\s،.]+)/);
  const plot = plotMatch?.[1]?.replace(/\s*\/\s*/g, "/").trim() ?? null;

  return {
    land_category: finalCategory,
    land_zone: finalZone,
    plot_number: plot && plot !== "و" ? plot : null,
  };
}
