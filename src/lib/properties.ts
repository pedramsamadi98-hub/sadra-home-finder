import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { enDigits, faDigits } from "@/lib/fa";
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
/** «وضعیت سند» — independent of ownership_type. null = ثبت نشده. */
export type DeedStatus = "single_sheet" | "attorney" | "none";
/** Search-only deed filter: «سند دارد» = single_sheet OR attorney. */
export type DeedFilter = DeedStatus | "has";

export const DEED_STATUS_LABELS: Record<DeedStatus, string> = {
  single_sheet: "سند تک برگ",
  attorney: "وکالتی",
  none: "بدون سند",
};

export const DEED_FILTER_LABELS: Record<DeedFilter, string> = {
  single_sheet: "سند تک برگ",
  attorney: "وکالتی",
  has: "سند دارد",
  none: "بدون سند",
};


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
  /** Short unique file number («کد فایل») — searchable, source-neutral. */
  file_code: number | null;
  /** When the file first entered the system. */
  initial_date: string | null;
  /** The price the file was first registered with. */
  initial_price: number | null;
  /** Latest price confirmed with the owner / broker. */
  verified_price: number | null;
  /** When `verified_price` was confirmed. */
  price_verified_at: string | null;
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
  /**
   * Manager-selected cover. null/absent = category default image. A path is
   * only honoured while it is still inside `photos` (never private_photos).
   */
  cover_photo?: string | null;
  /** «وضعیت سند»; null/absent = ثبت نشده. Not returned to collaborators. */
  deed_status?: DeedStatus | null;
  /** Real time of the latest sales activity; null = none recorded yet. */
  last_activity_at?: string | null;
  /** Current seller availability; null = unknown (never inferred). */
  seller_status?: "available" | "unavailable" | null;
  created_at: string;
  updated_at: string;
}

/**
 * Editable fields. The file code and the price-tracking fields are managed by
 * the database / the price-history helpers, never written by the form.
 */
export type PropertyInput = Omit<
  Property,
  | "id"
  | "user_id"
  | "created_at"
  | "updated_at"
  | "file_code"
  | "initial_date"
  | "verified_price"
  | "price_verified_at"
  | "cover_photo"
>;

/**
 * Saves the manager's cover choice: null = category default, path = a photo
 * of this property explicitly classified public_listing (never private/OCR or
 * unclassified), so a cover can never expose a private image.
 */
export async function setPropertyCover(property: Property, path: string | null) {
  if (path !== null) {
    const allowed =
      property.photos.includes(path) &&
      !property.private_photos.includes(path) &&
      (await fetchPhotoVisibility([path]))[path] === "public_listing";
    if (!allowed) {
      throw new Error("فقط عکس‌های قابل نمایش همین ملک می‌توانند تصویر اصلی باشند");
    }
  }
  const { error } = await supabase
    .from("properties")
    .update({ cover_photo: path })
    .eq("id", property.id);
  if (error) throw error;
}

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

/** Usage types that really ARE land — the only ones with land info to show. */
const LAND_TYPES = new Set<string>([
  "land",
  "land_phase_1",
  "land_phase_2",
  "apartment_land_phase_1",
  "apartment_land_phase_2",
  "zamin_baghshahri",
]);

/**
 * True only for real land usage types. Land category / zone / plot must be
 * decided from this, never from the presence of stored land values or from
 * address text (a non-land property may sit in a zone named «زمین …»).
 */
export function isLandType(propertyType: string | null | undefined): boolean {
  return Boolean(propertyType) && LAND_TYPES.has(propertyType as string);
}

export function showsPlotNumber(
  propertyType: string | null | undefined,
  landCategory?: string | null,
): boolean {
  if (propertyType && PLOT_TYPES.has(propertyType)) return true;
  // باغشهری and other legacy land categories keep their plot field visible.
  return Boolean(landCategory);
}


/** «امتیاز»: multi-unit project share — unit/floor unknown at registration. */
export function isEmtiazType(propertyType: string | null | undefined): boolean {
  return propertyType === "emtiaz";
}

/** «پیش‌فروش»: a known unit with a staged payment plan. */
export function isPresaleType(propertyType: string | null | undefined): boolean {
  return propertyType === "presale";
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

/**
 * Neighborhood labels are stored using the official zone labels (which start
 * with «زمین …»). That prefix is only meaningful for land listings, so every
 * display surface strips it — a neighborhood is part of the address.
 */
export function neighborhoodLabel(value: string | null | undefined): string {
  return value ? zoneDisplay(value) : "";
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
  initial_price: null,
  title: "",
  property_type: "complex",
  ownership_type: null,
  deed_status: null,
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

/* ----------------------------- archive scope ----------------------------- */

/** Statuses that mean «the file is no longer being offered». */
export const ARCHIVE_STATUSES: PropertyStatus[] = ["sold", "rented", "archived"];

export type ArchiveScope = "active" | "both" | "archive";

export const ARCHIVE_SCOPE_LABELS: Record<ArchiveScope, string> = {
  active: "فقط فعال",
  both: "فعال + آرشیو",
  archive: "فقط آرشیو",
};

export function isArchived(property: Pick<Property, "status">): boolean {
  return ARCHIVE_STATUSES.includes(property.status);
}

/** The archive scope combines with every other filter using AND. */
export function matchesArchiveScope(
  property: Pick<Property, "status">,
  scope: ArchiveScope,
): boolean {
  if (scope === "both") return true;
  return scope === "archive" ? isArchived(property) : !isArchived(property);
}

/** Sends a file to the archive without losing any of its information. */
export async function archiveProperty(id: string, status: PropertyStatus = "archived") {
  await updatePropertyStatus(id, status);
}

export async function restoreProperty(id: string) {
  await updatePropertyStatus(id, "active");
}

/* ------------------------------- file code ------------------------------- */

/** Human readable file code, e.g. «فایل ۷۷» — never reveals the file's source. */
export function fileCodeText(code: number | null | undefined): string {
  return code === null || code === undefined ? "—" : String(code);
}

export async function fetchPropertyByCode(code: number): Promise<Property | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("file_code", code)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Property) ?? null;
}

/* ---------------------------- price lifecycle ---------------------------- */

export type PriceEventKind = "price" | "update" | "note";
export type SellerStatus = "available" | "unavailable";
export const SELLER_STATUS_LABELS: Record<SellerStatus, string> = {
  available: "فروشنده است",
  unavailable: "فعلاً فروشنده نیست",
};
export type PriceEventSource = "manual" | "ocr" | "broker";

export interface PriceEvent {
  id: string;
  property_id: string;
  user_id: string;
  kind: PriceEventKind;
  price: number | null;
  deposit: number | null;
  monthly_rent: number | null;
  event_at: string;
  source: PriceEventSource;
  confidence: string | null;
  note: string | null;
  /** null = this event did not record a seller status. */
  seller_status?: SellerStatus | null;
  created_at: string;
  updated_at: string;
}

export type PriceEventInput = {
  price?: number | null;
  deposit?: number | null;
  monthly_rent?: number | null;
  event_at?: string | null;
  source?: PriceEventSource;
  confidence?: string | null;
  note?: string | null;
  kind?: PriceEventKind;
  /**
   * When false the event is recorded in the history only: the file's current
   * price stays untouched, because an unconfirmed reading (e.g. OCR) must never
   * be presented as today's price.
   */
  verify?: boolean;
};

/**
 * The price a search may treat as current: only a confirmed price counts.
 * A file whose price was never verified keeps its old value for reference,
 * but it must never be presented as today's price.
 */
export function currentPrice(property: Property): number | null {
  if (property.verified_price !== null && property.verified_price !== undefined) {
    return property.verified_price;
  }
  return null;
}

/** Fallback figure for display only («قیمت ثبت‌شده»), clearly labelled in UI. */
export function referencePrice(property: Property): number | null {
  return currentPrice(property) ?? property.price ?? property.initial_price ?? null;
}

/** True when no confirmed price exists — the file needs a price enquiry. */
/** Effective sale price used by search: verified_price, else price. */
export function effectiveSalePrice(property: Pick<Property, "verified_price" | "price">): number | null {
  if (property.verified_price !== null && property.verified_price !== undefined) {
    return property.verified_price;
  }
  return property.price ?? null;
}

/** Legacy land categories → equivalent usage type for files with no category. */
export const LEGACY_CATEGORY_TYPE: Record<string, string> = {
  residential_phase_1: "land_phase_1",
  residential_phase_2: "land_phase_2",
  apartment_phase_1: "apartment_land_phase_1",
  apartment_phase_2: "apartment_land_phase_2",
  baghshahri: "zamin_baghshahri",
};

export function needsPriceCheck(property: Property): boolean {
  return currentPrice(property) === null;
}

export async function fetchPriceEvents(propertyId: string): Promise<PriceEvent[]> {
  const { data, error } = await supabase
    .from("property_price_events")
    .select("*")
    .eq("property_id", propertyId)
    .order("event_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PriceEvent[];
}

/**
 * Records one point of a file's price history and — when it is the newest
 * confirmed price — refreshes the file's current price. The file itself is
 * never duplicated.
 */
export async function addPriceEvent(
  property: Property,
  userId: string,
  input: PriceEventInput,
) {
  const eventAt = input.event_at ?? new Date().toISOString();
  const { error } = await supabase.from("property_price_events").insert({
    property_id: property.id,
    user_id: userId,
    kind: input.kind ?? "price",
    price: input.price ?? null,
    deposit: input.deposit ?? null,
    monthly_rent: input.monthly_rent ?? null,
    event_at: eventAt,
    source: input.source ?? "manual",
    confidence: input.confidence ?? null,
    note: input.note?.trim() || null,
  });
  if (error) throw error;

  const isNewest =
    !property.price_verified_at ||
    new Date(eventAt).getTime() >= new Date(property.price_verified_at).getTime();
  if (input.verify !== false && input.price !== null && input.price !== undefined && isNewest) {
    const patch = {
      verified_price: input.price,
      price_verified_at: eventAt,
      price: input.price,
      ...(input.deposit !== null && input.deposit !== undefined
        ? { deposit: input.deposit }
        : {}),
      ...(input.monthly_rent !== null && input.monthly_rent !== undefined
        ? { monthly_rent: input.monthly_rent }
        : {}),
      ...(property.initial_price === null ? { initial_price: input.price } : {}),
    };
    const { error: updateError } = await supabase
      .from("properties")
      .update(patch)
      .eq("id", property.id);
    if (updateError) throw updateError;
  }
}

export type ManualEventInput =
  | { kind: "price"; price: number; seller_status?: SellerStatus | null; event_at?: string | null; note?: string | null }
  | { kind: "update"; seller_status: SellerStatus; event_at?: string | null; note?: string | null }
  | { kind: "note"; note: string; event_at?: string | null };

/**
 * Manual entry from the price form, written atomically by the
 * `add_property_price_event` database function (admin-only, identity from the
 * session). Bulk Import / OCR keep using `addPriceEvent` unchanged.
 * Returns the new event id.
 */
export async function addManualPriceEvent(propertyId: string, input: ManualEventInput): Promise<string> {
  const note = input.note?.trim() || undefined;
  const args: Database["public"]["Functions"]["add_property_price_event"]["Args"] = {
    _property_id: propertyId,
    _kind: input.kind,
    _source: "manual",
    ...(input.event_at ? { _event_at: input.event_at } : {}),
    ...(note ? { _note: note } : {}),
  };
  if (input.kind === "price") {
    if (!Number.isFinite(input.price) || input.price < 0) throw new Error("invalid price");
    args._price = input.price;
    args._verify = true;
    if (input.seller_status) args._seller_status = input.seller_status;
  } else if (input.kind === "update") {
    args._seller_status = input.seller_status;
  } else if (!note) {
    throw new Error("empty note");
  }
  const { data, error } = await supabase.rpc("add_property_price_event", args);
  if (error) throw error;
  if (typeof data !== "string" || !data) throw new Error("no event id returned");
  return data;
}

export async function deletePriceEvent(id: string) {
  const { error } = await supabase.from("property_price_events").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------ pagination ------------------------------- */

/**
 * Every list filter, expressed so it can run inside the database query.
 * The list view never downloads the whole table: filters + sort + range are
 * applied by Postgres and only one page of rows comes back.
 */
export interface PropertyQuery {
  text?: string;
  fileCode?: number | null;
  types?: string[] | undefined;
  ownership?: string | null;
  transaction?: string | null;
  status?: string | null;
  scope?: ArchiveScope;
  phase?: string | null;
  neighborhood?: string | null;
  landCategory?: string | null;
  landZone?: string | null;
  plotNumber?: string | null;
  brokerId?: string | null;
  minArea?: number | null;
  maxArea?: number | null;
  /** Exact bedroom count (bedrooms = N); NULL never matches. */
  bedrooms?: number | null;
  city?: string | null;
  /** Admin-only: collaborators' shared view has no deed column. */
  deed?: DeedFilter | null;
  /** Set when combined UI + smart filters contradict: the result is empty. */
  impossible?: boolean;
  minPrice?: number | null;
  maxPrice?: number | null;
  parking?: boolean | undefined;
  elevator?: boolean | undefined;
  storage?: boolean | undefined;
  page?: number;
  pageSize?: number;
}

export interface PropertyPage {
  rows: Property[];
  total: number;
  page: number;
  pageSize: number;
}

/** Columns a free-text search may look into, per audience. */
const TEXT_COLUMNS_ADMIN = [
  "title",
  "address",
  "street",
  "neighborhood",
  "phase",
  "land_zone",
  "plot_number",
  "owner_name",
  "owner_phone",
  "description",
  "notes",
];
const TEXT_COLUMNS_SHARED = [
  "title",
  "street",
  "neighborhood",
  "phase",
  "land_zone",
  "plot_number",
  "description",
];

function escapeOr(value: string): string {
  return value.replace(/[(),]/g, " ").trim();
}

export async function fetchPropertiesPage(
  isAdmin: boolean,
  q: PropertyQuery,
): Promise<PropertyPage> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, q.pageSize ?? 20));
  if (q.impossible) return { rows: [], total: 0, page: 1, pageSize };

  // Both audiences go through a real database query: admins read the table,
  // collaborators read the privacy-safe `shared_properties()` view function.
  const adminQuery = supabase.from("properties").select("*", { count: "exact" });
  let query = isAdmin
    ? adminQuery
    : (supabase.rpc("shared_properties", undefined, {
        count: "exact",
      }) as unknown as typeof adminQuery);

  const scope = q.scope ?? "active";
  if (scope === "archive") {
    query = query.in("status", ARCHIVE_STATUSES);
  } else if (scope === "active") {
    query = query.not("status", "in", `(${ARCHIVE_STATUSES.join(",")})`);
  }

  if (q.status) query = query.eq("status", q.status);
  if (q.types?.length) query = query.in("property_type", q.types);
  if (q.ownership) query = query.eq("ownership_type", q.ownership);
  if (q.transaction) query = query.eq("transaction_type", q.transaction);
  if (q.phase) query = query.eq("phase", q.phase);
  if (q.neighborhood) query = query.eq("neighborhood", q.neighborhood);
  if (q.landCategory) {
    // Exact stored category; legacy files (no category yet, typed by the
    // equivalent usage type) keep matching as before.
    const legacyType = LEGACY_CATEGORY_TYPE[q.landCategory];
    query = legacyType
      ? query.or(
          `land_category.eq.${q.landCategory},and(land_category.is.null,property_type.eq.${legacyType})`,
        )
      : query.eq("land_category", q.landCategory);
  }
  if (q.landZone) query = query.eq("land_zone", q.landZone);
  if (q.plotNumber) query = query.ilike("plot_number", `%${q.plotNumber}%`);
  if (isAdmin && q.brokerId) {
    query = q.brokerId === "none" ? query.is("broker_id", null) : query.eq("broker_id", q.brokerId);
  }
  if (q.minArea) query = query.gte("area", q.minArea);
  if (q.maxArea) query = query.lte("area", q.maxArea);
  if (q.bedrooms !== null && q.bedrooms !== undefined) query = query.eq("bedrooms", q.bedrooms);
  if (q.city) query = query.ilike("city", `%${q.city}%`);
  if (isAdmin && q.deed) {
    query =
      q.deed === "has"
        ? query.in("deed_status", ["single_sheet", "attorney"])
        : query.eq("deed_status", q.deed);
  }
  if (q.parking !== undefined) query = query.eq("parking", q.parking);
  if (q.elevator !== undefined) query = query.eq("elevator", q.elevator);
  if (q.storage !== undefined) query = query.eq("storage", q.storage);

  // A purely numeric query is a file code: exact match only. Any other text is
  // one OR-group over the audience's columns, ANDed with every other filter.
  // Stored text may use Persian or latin digits, so both spellings are tried.
  const text = escapeOr(q.text ?? "");
  if (q.fileCode !== null && q.fileCode !== undefined) {
    query = query.eq("file_code", q.fileCode);
  } else if (text) {
    const columns = isAdmin ? TEXT_COLUMNS_ADMIN : TEXT_COLUMNS_SHARED;
    const variants = Array.from(new Set([text, enDigits(text), faDigits(enDigits(text))]));
    const parts = columns.flatMap((column) =>
      variants.map((variant) => `${column}.ilike.%${variant}%`),
    );
    query = query.or(parts.join(","));
  }

  // Sale price range runs on the EFFECTIVE price: verified_price when it
  // exists, otherwise price. A verified price never falls back to the old one,
  // and a file with neither price never passes an active range.
  if (q.minPrice || q.maxPrice) {
    const verified: string[] = [];
    const fallback: string[] = [];
    if (q.minPrice) {
      verified.push(`verified_price.gte.${q.minPrice}`);
      fallback.push(`price.gte.${q.minPrice}`);
    }
    if (q.maxPrice) {
      verified.push(`verified_price.lte.${q.maxPrice}`);
      fallback.push(`price.lte.${q.maxPrice}`);
    }
    const rent: string[] = [];
    if (q.minPrice) rent.push(`deposit.gte.${q.minPrice}`);
    if (q.maxPrice) rent.push(`deposit.lte.${q.maxPrice}`);
    query = query.or(
      [
        `and(transaction_type.eq.sale,verified_price.not.is.null,${verified.join(",")})`,
        `and(transaction_type.eq.sale,verified_price.is.null,${fallback.join(",")})`,
        `and(transaction_type.neq.sale,${rent.join(",")})`,
      ].join(","),
    );
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;

  const rows = (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return isAdmin
      ? (record as unknown as Property)
      : ({
          ...record,
          user_id: null,
          broker_id: null,
          address: null,
          owner_name: null,
          owner_phone: null,
          notes: null,
          photos: (record["photos"] ?? []) as string[],
          private_photos: [],
        } as unknown as Property);
  });

  return { rows, total: count ?? rows.length, page, pageSize };
}
