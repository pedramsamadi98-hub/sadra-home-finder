import { enDigits, faDigits } from "@/lib/fa";
import type { Property, PropertyType, TransactionType } from "@/lib/properties";

export type CriterionKey =
  | "property_type"
  | "transaction_type"
  | "bedrooms"
  | "phase"
  | "city"
  | "minArea"
  | "maxArea"
  | "minPrice"
  | "maxPrice"
  | "parking"
  | "elevator"
  | "storage";

export interface Criterion {
  id: string;
  key: CriterionKey;
  label: string;
  value: string | number | boolean;
}

export interface ParsedQuery {
  criteria: Criterion[];
  rest: string;
}

const WORD_NUMBERS: Record<string, number> = {
  یک: 1,
  دو: 2,
  سه: 3,
  چهار: 4,
  پنج: 5,
  شش: 6,
  شیش: 6,
  هفت: 7,
  هشت: 8,
  نه: 9,
  ده: 10,
};

const NUM = `(\\d+(?:[.,]\\d+)?|${Object.keys(WORD_NUMBERS).join("|")})`;

function toNumber(token: string): number | null {
  const trimmed = token.trim();
  if (WORD_NUMBERS[trimmed] !== undefined) return WORD_NUMBERS[trimmed];
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalize(text: string): string {
  return enDigits(text)
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function faPriceLabel(value: number): string {
  const billion = Math.floor(value / 1_000_000_000);
  const million = Math.floor((value % 1_000_000_000) / 1_000_000);
  const parts: string[] = [];
  if (billion) parts.push(`${faDigits(billion)} میلیارد`);
  if (million) parts.push(`${faDigits(million)} میلیون`);
  if (!parts.length) return faDigits(value);
  return parts.join(" و ");
}

const MIN_WORDS = "بالای|بیشتر از|بیش از|حداقل|از";
const MAX_WORDS = "زیر|کمتر از|حداکثر|تا|پایین تر از";

export function parseSmartQuery(input: string): ParsedQuery {
  let text = ` ${normalize(input)} `;
  const criteria: Criterion[] = [];

  const add = (key: CriterionKey, label: string, value: string | number | boolean) => {
    if (criteria.some((c) => c.key === key)) return;
    criteria.push({ id: `${key}:${String(value)}`, key, label, value });
  };
  const strip = (match: string) => {
    text = text.replace(match, " ");
  };

  const take = (re: RegExp, handler: (m: RegExpMatchArray) => void) => {
    const m = text.match(re);
    if (m) {
      handler(m);
      strip(m[0]);
    }
  };

  // --- price (with units) ---
  const unit = "(میلیارد|میلیون)";
  const unitFactor = (u: string) => (u === "میلیارد" ? 1_000_000_000 : 1_000_000);

  take(
    new RegExp(`(?:بین|از)\\s*${NUM}\\s*(?:${unit})?\\s*تا\\s*${NUM}\\s*${unit}`),
    (m) => {
      const factor = unitFactor(m[4]!);
      const a = toNumber(m[1]!);
      const b = toNumber(m[3]!);
      if (a !== null) {
        const min = a * unitFactor(m[2] ?? m[4]!);
        add("minPrice", `از ${faPriceLabel(min)}`, min);
      }
      if (b !== null) {
        const max = b * factor;
        add("maxPrice", `تا ${faPriceLabel(max)}`, max);
      }
    },
  );
  take(new RegExp(`(?:${MAX_WORDS})\\s*${NUM}\\s*${unit}`), (m) => {
    const n = toNumber(m[1]!);
    if (n !== null) {
      const max = n * unitFactor(m[2]!);
      add("maxPrice", `تا ${faPriceLabel(max)}`, max);
    }
  });
  take(new RegExp(`(?:${MIN_WORDS})\\s*${NUM}\\s*${unit}`), (m) => {
    const n = toNumber(m[1]!);
    if (n !== null) {
      const min = n * unitFactor(m[2]!);
      add("minPrice", `از ${faPriceLabel(min)}`, min);
    }
  });

  // --- area ---
  const meter = "متری?(?:\\s*مربع)?";
  take(new RegExp(`(?:بین|از)\\s*${NUM}\\s*تا\\s*${NUM}\\s*${meter}`), (m) => {
    const a = toNumber(m[1]!);
    const b = toNumber(m[2]!);
    if (a !== null) add("minArea", `از ${faDigits(a)} متر`, a);
    if (b !== null) add("maxArea", `تا ${faDigits(b)} متر`, b);
  });
  take(new RegExp(`${NUM}\\s*تا\\s*${NUM}\\s*${meter}`), (m) => {
    const a = toNumber(m[1]!);
    const b = toNumber(m[2]!);
    if (a !== null) add("minArea", `از ${faDigits(a)} متر`, a);
    if (b !== null) add("maxArea", `تا ${faDigits(b)} متر`, b);
  });
  take(new RegExp(`(?:${MIN_WORDS})\\s*${NUM}\\s*${meter}`), (m) => {
    const n = toNumber(m[1]!);
    if (n !== null) add("minArea", `از ${faDigits(n)} متر`, n);
  });
  take(new RegExp(`(?:${MAX_WORDS})\\s*${NUM}\\s*${meter}`), (m) => {
    const n = toNumber(m[1]!);
    if (n !== null) add("maxArea", `تا ${faDigits(n)} متر`, n);
  });
  take(new RegExp(`${NUM}\\s*${meter}\\s*(?:به\\s*)?بالا`), (m) => {
    const n = toNumber(m[1]!);
    if (n !== null) add("minArea", `از ${faDigits(n)} متر`, n);
  });

  // --- bedrooms ---
  take(new RegExp(`${NUM}\\s*(?:خوابه?)`), (m) => {
    const n = toNumber(m[1]!);
    if (n !== null) add("bedrooms", `${faDigits(n)} خواب`, n);
  });

  // --- phase ---
  take(new RegExp(`فاز\\s*${NUM}`), (m) => {
    const n = toNumber(m[1]!);
    if (n !== null) add("phase", `فاز ${faDigits(n)}`, `فاز ${faDigits(n)}`);
  });

  // --- amenities ---
  const amenities: { key: CriterionKey; word: string; label: string }[] = [
    { key: "parking", word: "پارکینگ", label: "پارکینگ" },
    { key: "elevator", word: "آسانسور|اسانسور", label: "آسانسور" },
    { key: "storage", word: "انباری", label: "انباری" },
  ];
  for (const item of amenities) {
    const without = text.match(new RegExp(`بدون\\s*(?:${item.word})`));
    if (without) {
      add(item.key, `بدون ${item.label}`, false);
      strip(without[0]);
      continue;
    }
    const has = text.match(new RegExp(`(?:${item.word})`));
    if (has) {
      add(item.key, `${item.label} دارد`, true);
      strip(has[0]);
      text = text.replace(/\s(با|دارد|داشته باشند?|داشته باشد|و)\s/g, " ");
    }
  }

  // --- property type ---
  const types: { value: PropertyType; word: string; label: string }[] = [
    { value: "apartment", word: "آپارتمان|اپارتمان", label: "آپارتمان" },
    { value: "villa", word: "ویلایی|ویلا", label: "ویلا" },
    { value: "land", word: "زمین", label: "زمین" },
    { value: "commercial", word: "تجاری|مغازه", label: "تجاری" },
  ];
  for (const item of types) {
    const m = text.match(new RegExp(`(?:${item.word})`));
    if (m) {
      add("property_type", item.label, item.value);
      strip(m[0]);
      break;
    }
  }

  // --- transaction type ---
  const mortgage = text.match(/رهن(?:\s*و\s*اجاره)?/);
  if (mortgage) {
    add("transaction_type", "رهن و اجاره", "mortgage" satisfies TransactionType);
    strip(mortgage[0]);
  } else {
    const rent = text.match(/اجاره ای|اجاره‌ای|اجاره/);
    const sale = text.match(/فروشی|فروش/);
    if (rent && !text.match(/اجاره داده/)) {
      add("transaction_type", "اجاره", "rent" satisfies TransactionType);
      strip(rent[0]);
    } else if (sale && !text.match(/فروش رفته/)) {
      add("transaction_type", "فروش", "sale" satisfies TransactionType);
      strip(sale[0]);
    }
  }

  // --- city ---
  take(/(صدرا|شیراز)/, (m) => add("city", m[1]!, m[1]!));

  const rest = text
    .replace(/\b(ملک|ملک های|ملکهای|فایل|فایل های|فایلهای|با|و|در|که|داشته|باشند|باشد|دارد|متر|مربع|تومان|تا)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { criteria, rest };
}

export function matchesCriteria(property: Property, criteria: Criterion[]): boolean {
  for (const c of criteria) {
    switch (c.key) {
      case "property_type":
        if (property.property_type !== (c.value as PropertyType)) return false;
        break;
      case "transaction_type":
        if (property.transaction_type !== (c.value as TransactionType)) return false;
        break;
      case "bedrooms":
        if ((property.bedrooms ?? 0) < Number(c.value)) return false;
        break;
      case "phase":
        if (normalize(property.phase ?? "") !== normalize(String(c.value))) return false;
        break;
      case "city":
        if (!normalize(property.city ?? "").includes(normalize(String(c.value)))) return false;
        break;
      case "minArea":
        if ((property.area ?? 0) < Number(c.value)) return false;
        break;
      case "maxArea":
        if ((property.area ?? 0) > Number(c.value)) return false;
        break;
      case "minPrice":
      case "maxPrice": {
        const value =
          property.transaction_type === "sale" ? (property.price ?? 0) : (property.deposit ?? 0);
        if (c.key === "minPrice" && value < Number(c.value)) return false;
        if (c.key === "maxPrice" && value > Number(c.value)) return false;
        break;
      }
      case "parking":
        if (property.parking !== Boolean(c.value)) return false;
        break;
      case "elevator":
        if (property.elevator !== Boolean(c.value)) return false;
        break;
      case "storage":
        if (property.storage !== Boolean(c.value)) return false;
        break;
    }
  }
  return true;
}

/** Simple relevance score: matched criteria + text hits on important fields. */
export function relevanceScore(property: Property, criteria: Criterion[], text: string): number {
  let score = criteria.length * 2;
  const q = normalize(text).toLowerCase();
  if (q) {
    const title = normalize(property.title ?? "").toLowerCase();
    if (title.includes(q)) score += 5;
    if (normalize(property.neighborhood ?? "").toLowerCase().includes(q)) score += 3;
    if (normalize(property.phase ?? "").toLowerCase().includes(q)) score += 2;
    if (normalize(property.street ?? "").toLowerCase().includes(q)) score += 1;
  }
  if (property.photos.length) score += 1;
  return score;
}
