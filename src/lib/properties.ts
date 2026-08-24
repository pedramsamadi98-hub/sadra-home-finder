import { supabase } from "@/integrations/supabase/client";

export type PropertyType = "apartment" | "villa" | "land" | "commercial";
export type TransactionType = "sale" | "rent" | "mortgage";
export type PropertyStatus = "active" | "sold" | "rented" | "archived";
export type OwnershipType = "melki" | "owqaf";

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
  area: number | null;
  price: number | null;
  deposit: number | null;
  monthly_rent: number | null;
  bedrooms: number | null;
  floor: number | null;
  total_floors: number | null;
  building_age: number | null;
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

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "آپارتمان",
  villa: "ویلا",
  land: "زمین",
  commercial: "تجاری",
};

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

export const PHASES = [
  "فاز ۱",
  "فاز ۲",
  "فاز ۳",
  "فاز ۴",
  "فاز ۵",
  "فاز ۶",
  "سایر",
];

export const NEIGHBORHOODS = [
  "فاز ۱",
  "فاز ۲",
  "فاز ۳",
  "فاز ۴",
  "فاز ۵",
  "فاز ۶",
  "شهرک گلستان",
  "شهرک نگین",
  "سایر",
];

export const emptyProperty: PropertyInput = {
  broker_id: null,
  title: "",
  property_type: "apartment",
  ownership_type: null,
  transaction_type: "sale",
  status: "active",
  city: "صدرا",
  phase: "فاز ۱",
  neighborhood: "",
  street: "",
  address: "",
  area: null,
  price: null,
  deposit: null,
  monthly_rent: null,
  bedrooms: null,
  floor: null,
  total_floors: null,
  building_age: null,
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
