import type { Property, PropertyType } from "@/lib/properties";

/** The 16 default cover categories (one image file each, added later). */
export type DefaultCoverKey =
  | "complex" | "land_phase_1" | "land_phase_2" | "single_block" | "tabaq_villaei"
  | "villa_darbast" | "villa_package" | "apartment_land_phase_1" | "apartment_land_phase_2"
  | "office_unit" | "zamin_baghshahri" | "baghshahri" | "emtiaz" | "maskan_mehr" | "shop" | "presale";

/** Every stored property_type (16 canonical + 4 legacy) → its default cover. */
export const DEFAULT_COVER_MAP: Record<PropertyType, DefaultCoverKey> = {
  complex: "complex",
  land_phase_1: "land_phase_1",
  land_phase_2: "land_phase_2",
  single_block: "single_block",
  tabaq_villaei: "tabaq_villaei",
  villa_darbast: "villa_darbast",
  villa_package: "villa_package",
  apartment_land_phase_1: "apartment_land_phase_1",
  apartment_land_phase_2: "apartment_land_phase_2",
  office_unit: "office_unit",
  zamin_baghshahri: "zamin_baghshahri",
  baghshahri: "baghshahri",
  emtiaz: "emtiaz",
  maskan_mehr: "maskan_mehr",
  shop: "shop",
  presale: "presale",
  // Legacy values (display only).
  apartment: "complex",
  villa: "villa_darbast",
  land: "land_phase_1",
  commercial: "shop",
};

/**
 * Real images are dropped into src/assets/property-type-defaults/ as
 * `<key>.<ext>.asset.json` pointers. Until then no image exists and the UI
 * shows a styled type tile instead (never a broken image or fake picture).
 */
const pointers = import.meta.glob<{ url: string }>(
  "../assets/property-type-defaults/*.asset.json",
  { eager: true, import: "default" },
);
const URLS: Partial<Record<string, string>> = {};
for (const [file, ptr] of Object.entries(pointers)) {
  const key = file.split("/").pop()!.split(".")[0]!;
  if (ptr?.url) URLS[key] = ptr.url;
}

export function defaultCoverKey(type: string | null | undefined): DefaultCoverKey {
  return DEFAULT_COVER_MAP[type as PropertyType] ?? "complex";
}

export function defaultCoverUrl(type: string | null | undefined): string | null {
  return URLS[defaultCoverKey(type)] ?? null;
}

/** Real cover only if chosen AND still a public photo; otherwise default. */
export function resolvedCoverPath(p: Pick<Property, "photos" | "cover_photo">): string | null {
  return p.cover_photo && p.photos.includes(p.cover_photo) ? p.cover_photo : null;
}
