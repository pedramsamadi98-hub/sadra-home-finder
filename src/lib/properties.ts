import { supabase } from "@/integrations/supabase/client";
import { LAND_CATEGORIES } from "@/lib/land";

/** Legacy values kept for existing rows. */
export type LegacyPropertyType = "apartment" | "villa" | "land" | "commercial";
/** New usage types (نوع کاربری ملک). */
export type NewPropertyType =
  | "complex"
  | "land_phase_1"
  | "land_phase_2"
  | "single_block"
  | "tabaq_villaei"
  | "villa_package"
  | "villa_darbast"
  | "apartment_land_phase_1"
  | "apartment_land_phase_2"
  | "baghshahri"
  | "zamin_baghshahri"
  | "office_unit"
  | "shop"
  | "maskan_mehr"
  | "emtiaz"
  | "presale";
export type PropertyType = NewPropertyType | LegacyPropertyType;
export type TransactionType = "sale" | "rent" | "mortgage";
export type PropertyStatus = "active" | "sold" | "rented" | "archived";
export type OwnershipType = "melki" | "owqaf";


/** One step of a پیش‌فروش payment plan. */
export interface PaymentStep {
  [key: string]: string | number | null;
  title: string;
  amount: number | null;
  note: string;
}

/** Normalizes the stored jsonb payment plan into typed steps. */
export function paymentSteps(value: unknown): PaymentStep[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const amount = Number(row["amount"]);
    return {
      title: typeof row["title"] === "string" ? row["title"] : "",
      amount: Number.isFinite(amount) ? amount : null,
      note: typeof row["note"] === "string" ? row["note"] : "",
    };
  });
}

/** پیش‌فروش: باقی‌مانده = قیمت کل − مجموع پرداخت‌های ثبت‌شده */
export function presaleRemaining(
  total: number | null,
  steps: PaymentStep[],
): number {
  const paid = steps.reduce((sum, step) => sum + (step.amount ?? 0), 0);
  return (total ?? 0) - paid;
}

export interface Property {
  id: string;
  user_id: string | null;
  broker_id: string | null;
  title: string;
  property_type: PropertyType;
  ownership_type: OwnershipType | null;
  transaction_type: TransactionType;
  status: PropertyStatus;
  city: string;
  phase: string | null;
  neighborhood: string | null;
  street: string | null;
  address: string | null;
  /** Land category id from `LAND_CATEGORIES` (src/lib/land.ts). */
  land_category: string | null;
  /** Canonical zone label belonging to the selected land category. */
  land_zone: string | null;
  /** Free-text plot number, e.g. «۲۲/الف» or «۱۳۲ فرعی». */
  plot_number: string | null;
  area: number | null;
  price: number | null;
  deposit: number | null;
  monthly_rent: number | null;
  bedrooms: number | null;
  floor: number | null;
  total_floors: number | null;
  building_age: number | null;
  /** «شماره واحد» — used by پیش‌فروش files. */
  unit_number: string | null;
  /** «قیمت واریزی» — امتیاز only, independent amount. */
  deposited_amount: number | null;
  /** «مبلغ قابل پرداخت به شرکت» — امتیاز only, optional. */
  company_payable_amount: number | null;
  /** «شرایط پرداخت به شرکت» — امتیاز only, optional free text. */
  company_payment_terms: string | null;
  /** «برنامه پرداخت» — پیش‌فروش only. */
  payment_plan: PaymentStep[];
  /** توضیح کلی شرایط پرداخت — پیش‌فروش only. */
  payment_terms: string | null;
  parking: boolean;
  elevator: boolean;
  storage: boolean;
  owner_name: string | null;
  owner_phone: string | null;
  description: string | null;
  notes: string | null;
  photos: string[];
  /** Private OCR source images. Admin-only, never returned to collaborators. */
  private_photos: string[];
  created_at: string;
  updated_at: string;
}

export type PropertyInput = Omit<
  Property,
  "id" | "user_id" | "created_at" | "updated_at"
>;

/** Selectable usage types in the form (نوع کاربری ملک). */
export const PROPERTY_TYPE_LABELS: Record<NewPropertyType, string> = {
  complex: "مجتمع",
  land_phase_1: "زمین فاز ۱",
  land_phase_2: "زمین فاز ۲",
  single_block: "تک‌بلوک شخصی‌ساز",
  tabaq_villaei: "طبق ویلایی",
  villa_package: "ویلایی پکیج",
  villa_darbast: "ویلایی دربست",
  apartment_land_phase_1: "زمین آپارتمانی فاز ۱",
  apartment_land_phase_2: "زمین آپارتمانی فاز ۲",
  baghshahri: "باغشهری",
  zamin_baghshahri: "زمین باغشهری",
  office_unit: "واحد اداری",
  shop: "مغازه",
  maskan_mehr: "مسکن مهر",
  emtiaz: "امتیاز",
  presale: "پیش‌فروش",
};

/** Older values still present in saved rows — display only, never lost. */
export const LEGACY_PROPERTY_TYPE_LABELS: Record<LegacyPropertyType, string> = {
  apartment: "آپارتمان",
  villa: "ویلا",
  land: "زمین",
  commercial: "تجاری",
};

/** Every value that can appear in the database. */
export const ALL_PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  ...PROPERTY_TYPE_LABELS,
  ...LEGACY_PROPERTY_TYPE_LABELS,
};

export function propertyTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ALL_PROPERTY_TYPE_LABELS[value as PropertyType] ?? value;
}

/** Usage types where a plot number (پلاک) is meaningful — always optional. */
const PLOT_TYPES = new Set<string>([
  "land_phase_1",
  "land_phase_2",
  "apartment_land_phase_1",
  "apartment_land_phase_2",
  "tabaq_villaei",
  "villa_package",
  "villa_darbast",
  "baghshahri",
  "zamin_baghshahri",
  "land",
  "presale",
]);

export function showsPlotNumber(
  propertyType: string | null | undefined,
  landCategory?: string | null,
): boolean {
  if (propertyType && PLOT_TYPES.has(propertyType)) return true;
  // باغشهری and other legacy land categories keep their plot field visible.
  return Boolean(landCategory);
}

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  sale: "فروش",
  rent: "اجاره",
  mortgage: "رهن و اجاره",
};

export const OWNERSHIP_LABELS: Record<OwnershipType, string> = {
  melki: "ملکی",
  owqaf: "اوقاف",
};

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  active: "فعال",
  sold: "فروش رفته",
  rented: "اجاره داده شده",
  archived: "بایگانی",
};

export const CITIES = ["صدرا"];

export const PHASES = ["فاز ۱", "فاز ۲", "فاز ۳"];

/** Display label for a stored zone label (drops the redundant «زمین » prefix). */
function zoneDisplay(label: string): string {
  return label.replace(/^زمین\s+/, "");
}

function zoneOptions(categoryId: string) {
  return (LAND_CATEGORIES.find((item) => item.id === categoryId)?.zones ?? []).map((zone) => ({
    value: zone.label,
    label: zoneDisplay(zone.label),
  }));
}

/** Phase-dependent neighborhoods, derived from the official land zones. */
export const NEIGHBORHOODS_BY_PHASE: Record<string, { value: string; label: string }[]> = {
  "فاز ۱": zoneOptions("residential_phase_1"),
  "فاز ۲": zoneOptions("residential_phase_2"),
  "فاز ۳": [],
};

export function neighborhoodsFor(phase: string | null | undefined) {
  if (!phase) return [];
  return NEIGHBORHOODS_BY_PHASE[phase] ?? [];
}

/** Usage types whose neighborhoods are the باغشهری zones (not phase-based). */
const BAGHSHAHRI_TYPES = new Set<string>(["baghshahri", "zamin_baghshahri"]);

export function isBaghshahriType(propertyType: string | null | undefined): boolean {
  return Boolean(propertyType) && BAGHSHAHRI_TYPES.has(propertyType as string);
}

/**
 * Neighborhood options for the form: باغشهری usage types list the باغشهری
 * zones; everything else keeps the phase → neighborhood structure.
 */
export function neighborhoodsForType(
  propertyType: string | null | undefined,
  phase: string | null | undefined,
) {
  if (isBaghshahriType(propertyType)) return zoneOptions("baghshahri");
  return neighborhoodsFor(phase);
}

export const NEIGHBORHOODS = Object.values(NEIGHBORHOODS_BY_PHASE)
  .flat()
  .map((item) => item.value);


export const emptyProperty: PropertyInput = {
  broker_id: null,
  title: "",
  property_type: "complex",
  ownership_type: null,
  transaction_type: "sale",
  status: "active",
  city: "صدرا",
  phase: "فاز ۱",
  neighborhood: "",
  street: "",
  address: "",
  land_category: null,
  land_zone: null,
  plot_number: "",
  area: null,
  price: null,
  deposit: null,
  monthly_rent: null,
  bedrooms: null,
  floor: null,
  total_floors: null,
  building_age: null,
  unit_number: "",
  deposited_amount: null,
  company_payable_amount: null,
  company_payment_terms: "",
  payment_plan: [],
  payment_terms: "",
  parking: false,
  elevator: false,
  storage: false,
  owner_name: "",
  owner_phone: "",
  description: "",
  notes: "",
  photos: [],
  private_photos: [],
};

export async function fetchProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Property[];
}

/**
 * Collaborator-safe read: goes through the server-side `shared_properties`
 * function, which never returns owner contact info, broker links, private
 * notes, address or photos.
 */
export async function fetchSharedProperties(): Promise<Property[]> {
  const { data, error } = await supabase.rpc("shared_properties");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...(row as Record<string, unknown>),
    user_id: null,
    broker_id: null,
    address: null,
    owner_name: null,
    owner_phone: null,
    notes: null,
    photos: ((row as { photos?: string[] | null }).photos ?? []) as string[],
    private_photos: [],
  })) as unknown as Property[];
}

export async function fetchPropertiesFor(isAdmin: boolean): Promise<Property[]> {
  return isAdmin ? fetchProperties() : fetchSharedProperties();
}

export async function fetchProperty(id: string): Promise<Property> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("ملک پیدا نشد");
  return data as unknown as Property;
}

export async function fetchPropertyFor(id: string, isAdmin: boolean): Promise<Property> {
  if (isAdmin) return fetchProperty(id);
  const shared = await fetchSharedProperties();
  const found = shared.find((item) => item.id === id);
  if (!found) throw new Error("ملک پیدا نشد");
  return found;
}

export async function createProperty(input: PropertyInput, userId: string) {
  const { data, error } = await supabase
    .from("properties")
    .insert({ ...input, user_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateProperty(id: string, input: PropertyInput) {
  const { error } = await supabase.from("properties").update(input).eq("id", id);
  if (error) throw error;
}

export async function updatePropertyOwnership(id: string, ownership: OwnershipType) {
  const { error } = await supabase
    .from("properties")
    .update({ ownership_type: ownership })
    .eq("id", id);
  if (error) throw error;
}

export async function updatePropertyStatus(id: string, status: PropertyStatus) {
  const { error } = await supabase.from("properties").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteProperty(id: string) {
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw error;
}

export type PhotoVisibility = "public_listing" | "private_ocr";

export const PHOTO_VISIBILITY_LABELS: Record<PhotoVisibility, string> = {
  public_listing: "قابل نمایش",
  private_ocr: "خصوصی / OCR",
};

/** Records the access class of an uploaded image (drives the storage policies). */
async function registerPhotoVisibility(
  paths: string[],
  userId: string,
  visibility: PhotoVisibility,
  propertyId?: string | null,
) {
  if (!paths.length) return;
  const { error } = await supabase.from("photo_visibility").upsert(
    paths.map((storage_path) => ({
      storage_path,
      user_id: userId,
      visibility,
      property_id: propertyId ?? null,
    })),
    { onConflict: "storage_path" },
  );
  if (error) throw error;
}

export async function fetchPhotoVisibility(
  paths: string[],
): Promise<Record<string, PhotoVisibility>> {
  if (!paths.length) return {};
  const { data, error } = await supabase
    .from("photo_visibility")
    .select("storage_path, visibility")
    .in("storage_path", paths);
  if (error) throw error;
  const map: Record<string, PhotoVisibility> = {};
  for (const row of data ?? []) {
    map[row.storage_path] = row.visibility as PhotoVisibility;
  }
  return map;
}

/** Marks an existing (legacy/unclassified) image as displayable or private. */
export async function setPhotoVisibility(
  path: string,
  userId: string,
  visibility: PhotoVisibility,
  propertyId?: string | null,
) {
  await registerPhotoVisibility([path], userId, visibility, propertyId);
}

export async function movePhotoToPrivate(property: Property, path: string) {
  const { error } = await supabase
    .from("properties")
    .update({
      photos: property.photos.filter((item) => item !== path),
      private_photos: [...property.private_photos, path],
    })
    .eq("id", property.id);
  if (error) throw error;
  await setPhotoVisibility(path, property.user_id ?? "", "private_ocr", property.id);
}

export async function movePhotoToPublic(property: Property, path: string) {
  const { error } = await supabase
    .from("properties")
    .update({
      private_photos: property.private_photos.filter((item) => item !== path),
      photos: property.photos.includes(path) ? property.photos : [...property.photos, path],
    })
    .eq("id", property.id);
  if (error) throw error;
  await setPhotoVisibility(path, property.user_id ?? "", "public_listing", property.id);
}

/** Permanently removes a private OCR image (storage object + metadata). */
export async function deletePrivatePhoto(property: Property, path: string) {
  const { error } = await supabase
    .from("properties")
    .update({ private_photos: property.private_photos.filter((item) => item !== path) })
    .eq("id", property.id);
  if (error) throw error;
  await supabase.from("photo_visibility").delete().eq("storage_path", path);
  await supabase.storage.from("property-photos").remove([path]);
}

export async function uploadPhotos(
  files: File[],
  userId: string,
  visibility: PhotoVisibility = "public_listing",
): Promise<string[]> {
  const paths: string[] = [];
  const folder = visibility === "private_ocr" ? "private" : "public";
  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("property-photos")
      .upload(path, file, { contentType: file.type || "image/jpeg" });
    if (error) throw error;
    paths.push(path);
  }
  await registerPhotoVisibility(paths, userId, visibility);
  return paths;
}

export async function signedPhotoUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage
    .from("property-photos")
    .createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  return (data ?? [])
    .map((item) => item.signedUrl)
    .filter((url): url is string => Boolean(url));
}
