import { enDigits, faDigits } from "@/lib/fa";
import {
  LAND_CATEGORY_LABELS,
  aliasRegex,
  aliasesOf,
  detectLand,
  landCategory,
  normalizeFa,
} from "@/lib/land";
import type {
  OwnershipType,
  Property,
  PropertyType,
  TransactionType,
} from "@/lib/properties";

export type CriterionKey =
  | "property_type"
  | "ownership_type"
  | "transaction_type"
  | "bedrooms"
  | "phase"
  | "city"
  | "land_category"
  | "land_zone"
  | "plot_number"
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

  // --- land category / zone / plot (official taxonomy) ---
  const land = detectLand(text);
  const stripAliases = (aliases: string[]) => {
    for (const alias of aliases) {
      text = text.replace(aliasRegex(alias, "g"), " ");
    }
    text = ` ${text.replace(/\s+/g, " ").trim()} `;
  };
  if (land.land_category) {
    const category = landCategory(land.land_category);
    if (category) {
      add("land_category", category.label, category.id);
      stripAliases([category.label, ...(category.aliases ?? [])]);
      // «فاز ۱/۲» is already part of the category — don't also filter by phase.
      const phaseInLabel = normalizeFa(category.label).match(/فاز\s*(\d)/);
      if (phaseInLabel) {
        text = text.replace(new RegExp(`فاز\\s*${phaseInLabel[1]}`, "g"), " ");
      }
    }
  }
  if (land.land_zone) {
    const zone = landCategory(land.land_category)?.zones.find(
      (item) => item.label === land.land_zone,
    );
    if (zone) {
      add("land_zone", zone.label, zone.label);
      stripAliases(aliasesOf(zone));
    }
  }
  if (land.plot_number) {
    add("plot_number", `پلاک ${faDigits(land.plot_number)}`, land.plot_number);
    text = text.replace(
      new RegExp(`پلاک\\s*${land.plot_number.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`, "g"),
      " ",
    );
    text = text.replace(/\s*پلاک\s*/g, " ");
  }



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

  // --- ownership type (ملکی / اوقاف) ---
  const bothOwnership = text.match(
    /(?:ملکی|اوقافی?)\s*(?:یا|و)\s*(?:ملکی|اوقافی?)|فرقی\s*نداره|فرقی\s*نمیکنه|مهم\s*نیست/,
  );
  if (bothOwnership) {
    strip(bothOwnership[0]);
    text = text.replace(/ملکی|اوقافی?/g, " ");
  } else {
    const owqaf = text.match(/اوقافی|اوقاف/);
    const melki = text.match(/ملکی/);
    if (owqaf) {
      add("ownership_type", "اوقاف", "owqaf" satisfies OwnershipType);
      strip(owqaf[0]);
    } else if (melki) {
      add("ownership_type", "ملکی", "melki" satisfies OwnershipType);
      strip(melki[0]);
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

  const STOP_WORDS = new Set([
    "ملک",
    "ملکهای",
    "ملکها",
    "فایل",
    "میخوام",
    "می",
    "خوام",
    "بخوام",
    "دنبال",
    "فقط",
    "فرقی",
    "نداره",
    "نمیکنه",
    "مهم",
    "نیست",
    "فایلهای",
    "فایلها",
    "های",
    "ها",
    "با",
    "و",
    "در",
    "که",
    "داشته",
    "باشند",
    "باشد",
    "دارد",
    "متر",
    "متری",
    "مربع",
    "تومان",
    "تا",
    "از",
    "بین",
    "زیر",
    "بالای",
    "حداقل",
    "حداکثر",
    "خواب",
    "خوابه",
  ]);

  const rest = text
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token))
    .join(" ")
    .trim();

  return { criteria, rest };
}

export function matchesCriteria(property: Property, criteria: Criterion[]): boolean {
  for (const c of criteria) {
    switch (c.key) {
      case "property_type":
        if (property.property_type !== (c.value as PropertyType)) return false;
        break;
      case "ownership_type":
        if (property.ownership_type !== (c.value as OwnershipType)) return false;
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
      case "land_category":
        if (property.land_category !== String(c.value)) return false;
        break;
      case "land_zone":
        if (normalizeFa(property.land_zone ?? "") !== normalizeFa(String(c.value))) return false;
        break;
      case "plot_number":
        if (
          !normalizeFa(property.plot_number ?? "").includes(normalizeFa(String(c.value)))
        )
          return false;
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
    if (normalizeFa(property.land_zone ?? "").toLowerCase().includes(q)) score += 3;
    if (normalizeFa(property.plot_number ?? "").toLowerCase().includes(q)) score += 3;
    if (
      LAND_CATEGORY_LABELS[property.land_category ?? ""] &&
      normalizeFa(LAND_CATEGORY_LABELS[property.land_category ?? ""]!).toLowerCase().includes(q)
    )
      score += 2;
  }
  if (property.photos.length) score += 1;
  return score;
}
