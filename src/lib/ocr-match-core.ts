/**
 * Shared matching core for OCR readings.
 *
 * The exact candidate lookups and scoring that ran in the browser now live here,
 * parameterised by a Supabase-like client, so the browser flow (ocr-match.ts)
 * and the server worker (bulk-worker.functions.ts) use ONE implementation.
 * No scoring rule, weight or threshold was changed.
 */

import { enDigits } from "@/lib/fa";
import type { OcrResult } from "@/lib/ocr.functions";
import type { Property } from "@/lib/properties";

export type MatchConfidence = "high" | "medium" | "low";

export interface OcrCandidate {
  property: Property;
  score: number;
  confidence: MatchConfidence;
  /** Persian reasons shown in the confirmation dialog. */
  reasons: string[];
}

/** Minimal shape both the browser client and the admin client satisfy. */
export interface MatchClient {
  from: (table: "properties") => any;
}

export function norm(value: string | null | undefined): string {
  if (!value) return "";
  return enDigits(String(value))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function digitsOnly(value: string | null | undefined): string {
  return value ? enDigits(String(value)).replace(/\D/g, "") : "";
}

const CANDIDATE_LIMIT = 15;

/**
 * Finds the few files an OCR reading may belong to. Only narrow, indexed
 * lookups run — never a full table read — so this stays usable with tens of
 * thousands of files. Price and price date are deliberately NOT used as
 * matching signals: prices change over time and belong to the price history.
 */
export async function findOcrCandidatesWith(
  client: MatchClient,
  result: OcrResult,
): Promise<OcrCandidate[]> {
  const found = new Map<string, Property>();

  const collect = async (build: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const { data, error } = await build();
    if (error) return;
    for (const row of (data ?? []) as Property[]) found.set(row.id, row);
  };

  // 1) File code — the strongest, single-row lookup.
  if (result.file_code) {
    await collect(() =>
      client.from("properties").select("*").eq("file_code", result.file_code!).limit(1),
    );
  }

  // 2) Owner phone — unique in practice.
  const phone = digitsOnly(result.owner_phone);
  if (phone.length >= 7) {
    await collect(() =>
      client
        .from("properties")
        .select("*")
        .ilike("owner_phone", `%${phone.slice(-9)}%`)
        .limit(CANDIDATE_LIMIT),
    );
  }

  // 3) Plot number.
  if (result.plot_number) {
    await collect(() =>
      client
        .from("properties")
        .select("*")
        .ilike("plot_number", `%${enDigits(result.plot_number!).trim()}%`)
        .limit(CANDIDATE_LIMIT),
    );
  }

  // 4) Location + area window (±3%).
  if (result.area && (result.neighborhood || result.phase)) {
    await collect(() => {
      let query = client
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
      client.from("properties").select("*").ilike("title", `%${titleText}%`).limit(CANDIDATE_LIMIT),
    );
  }

  // 6) Street / address text — a sheet often names only the street.
  const street = norm(result.street) || norm(result.address).split(" ").slice(0, 3).join(" ");
  if (street.length >= 3) {
    await collect(() =>
      client
        .from("properties")
        .select("*")
        .or(`street.ilike.%${street}%,address.ilike.%${street}%,title.ilike.%${street}%`)
        .limit(CANDIDATE_LIMIT),
    );
  }

  // 7) Area alone (±2%) — narrow and indexed, catches sheets with no location text.
  if (result.area) {
    await collect(() =>
      client
        .from("properties")
        .select("*")
        .gte("area", Math.floor(result.area! * 0.98))
        .lte("area", Math.ceil(result.area! * 1.02))
        .limit(CANDIDATE_LIMIT),
    );
  }

  const scored = [...found.values()]
    .map((property) => scoreCandidate(property, result))
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 5);
}

export function scoreCandidate(property: Property, result: OcrResult): OcrCandidate {
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
