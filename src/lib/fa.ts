const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert every latin digit in a string/number to a Persian digit. */
export function faDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

/** Convert Persian/Arabic digits back to latin (for parsing user input). */
export function enDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function parseNumber(value: string): number | null {
  const cleaned = enDigits(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Group a number with Persian digits and thousands separators. */
export function faNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return faDigits(value.toLocaleString("en-US"));
}

/** Human, short Toman price: ۶ میلیارد و ۵۰۰ میلیون تومان */
export function faPrice(value: number | null | undefined): string {
  if (!value) return "توافقی";
  const billion = Math.floor(value / 1_000_000_000);
  const million = Math.floor((value % 1_000_000_000) / 1_000_000);
  const parts: string[] = [];
  if (billion) parts.push(`${faDigits(billion)} میلیارد`);
  if (million) parts.push(`${faDigits(million)} میلیون`);
  if (!parts.length) return `${faNumber(value)} تومان`;
  return `${parts.join(" و ")} تومان`;
}

export function faArea(value: number | null | undefined): string {
  if (!value) return "—";
  return `${faDigits(value)} متر`;
}

const jalali = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function faDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return jalali.format(date);
}

export function faRelative(value: string | null | undefined): string {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "امروز";
  if (days === 1) return "دیروز";
  if (days < 30) return `${faDigits(days)} روز پیش`;
  return faDate(value);
}
