import { unzip } from "fflate";

import { detectLand } from "@/lib/land";
import type { OcrResult } from "@/lib/ocr.functions";
import { jalaliToISO, priceEventsOf } from "@/lib/ocr-match";
import {
  addPriceEvent,
  createProperty,
  emptyProperty,
  fetchProperty,
  isLandType,
  type PropertyInput,
  updateProperty,
  uploadPhotos,
} from "@/lib/properties";

/* ------------------------------- queue model ------------------------------ */

export type BatchStatus =
  | "pending"
  | "ocr"
  | "review"
  | "manual"
  | "duplicate"
  | "linked"
  | "done"
  | "error";

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  pending: "در انتظار",
  ocr: "در حال OCR",
  review: "نیازمند بررسی",
  manual: "نیازمند بررسی دستی",
  duplicate: "تکراری",
  linked: "متصل به فایل موجود",
  done: "ثبت شد",
  error: "خطا",
};

export const BATCH_STATUS_TONE: Record<BatchStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  ocr: "bg-primary/15 text-primary",
  review: "bg-warning/15 text-warning",
  manual: "bg-warning/15 text-warning",
  duplicate: "bg-muted text-muted-foreground",
  linked: "bg-primary/15 text-primary",
  done: "bg-success/15 text-success",
  error: "bg-destructive/15 text-destructive",
};

export interface BatchItem {
  id: string;
  /** File name as chosen or as stored inside the ZIP (folder path kept). */
  name: string;
  /** Folder path inside the ZIP, empty for directly chosen images. */
  folder: string;
  size: number;
  source: "file" | "zip";
  zipName?: string;
  status: BatchStatus;
  error?: string | null;
  /** Number of candidate files suggested for review. */
  candidateCount?: number;
  /** Created / linked property, so the user can open it. */
  propertyId?: string | null;
  fileCode?: number | null;
  hash?: string | null;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i;

export function isImageName(name: string): boolean {
  const base = name.split("/").pop() ?? name;
  if (!base || base.startsWith(".")) return false;
  return IMAGE_EXT.test(base);
}

function mimeOf(name: string): string {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "bmp") return "image/bmp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return "image/jpeg";
}

/* --------------------------------- ZIP ----------------------------------- */

export interface ZipExpansion {
  files: { name: string; folder: string; file: File }[];
  /** Non-image entries that were skipped on purpose. */
  skipped: string[];
}

/**
 * Extracts the images of a ZIP in memory. Folder structure is kept in the
 * entry name so the queue can show where an image came from. Non-image entries
 * are reported, never silently dropped, and a corrupt archive only fails
 * itself.
 */
export async function expandZip(zipFile: File): Promise<ZipExpansion> {
  const bytes = new Uint8Array(await zipFile.arrayBuffer());
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, (error, data) => {
      if (error) reject(new Error("فایل ZIP خوانده نشد"));
      else resolve(data);
    });
  });

  const files: ZipExpansion["files"] = [];
  const skipped: string[] = [];
  for (const [name, content] of Object.entries(entries)) {
    if (name.endsWith("/") || !content.length) continue;
    if (!isImageName(name)) {
      skipped.push(name);
      continue;
    }
    const parts = name.split("/");
    const base = parts.pop() ?? name;
    const buffer = new Uint8Array(content).slice().buffer as ArrayBuffer;
    files.push({
      name,
      folder: parts.join("/"),
      file: new File([buffer], base, { type: mimeOf(base) }),
    });
  }
  return { files, skipped };
}

/* ---------------------------- duplicate images --------------------------- */

const LEDGER_KEY = "sadra:batch-image-hashes";
const LEDGER_MAX = 20000;

export async function hashFile(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

export function loadHashLedger(): Set<string> {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

export function saveHashLedger(hashes: Set<string>) {
  try {
    const list = Array.from(hashes).slice(-LEDGER_MAX);
    localStorage.setItem(LEDGER_KEY, JSON.stringify(list));
  } catch {
    /* storage full or unavailable — duplicate detection stays batch-only */
  }
}

/* ------------------------------ OCR → input ------------------------------ */

/** True when the reading carries enough to be worth creating a file from. */
export function hasEnoughData(result: OcrResult): boolean {
  const signals = [
    result.area,
    result.address,
    result.street,
    result.neighborhood,
    result.owner_phone,
    result.owner_name,
    result.plot_number,
    result.title,
    result.price,
  ].filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
  return signals.length >= 2;
}

function fallbackTitle(result: OcrResult): string {
  const parts = [result.title, result.street, result.neighborhood, result.phase, result.address]
    .map((value) => (value ?? "").trim())
    .filter(Boolean);
  return parts[0] ? parts.slice(0, 2).join(" ") : "فایل بدون عنوان (ورود گروهی)";
}

/** Builds a create-payload from a reading, mirroring the single-file flow. */
export function ocrResultToInput(result: OcrResult): PropertyInput {
  const type = (result.property_type ?? emptyProperty.property_type) as PropertyInput["property_type"];
  const landAllowed = isLandType(type);
  const haystack = [
    result.land_text,
    result.title,
    result.neighborhood,
    result.street,
    result.address,
    result.description,
    result.notes,
  ]
    .filter(Boolean)
    .join(" ");
  const detected = landAllowed ? detectLand(haystack) : null;
  const events = priceEventsOf(result);
  const newest = events.length ? (events[events.length - 1]?.price ?? null) : (result.price ?? null);
  const oldest = events.length ? (events[0]?.price ?? null) : (result.price ?? null);

  return {
    ...emptyProperty,
    title: fallbackTitle(result),
    property_type: type,
    transaction_type: result.transaction_type ?? emptyProperty.transaction_type,
    city: result.city ?? emptyProperty.city,
    phase: result.phase ?? null,
    neighborhood: result.neighborhood ?? null,
    street: result.street ?? null,
    address: result.address ?? null,
    land_category: detected?.land_category ?? null,
    land_zone: detected?.land_zone ?? null,
    plot_number: landAllowed ? (result.plot_number ?? detected?.plot_number ?? null) : null,
    area: result.area ?? null,
    price: newest,
    initial_price: oldest,
    deposit: result.deposit ?? null,
    monthly_rent: result.monthly_rent ?? null,
    bedrooms: result.bedrooms ?? null,
    floor: result.floor ?? null,
    total_floors: result.total_floors ?? null,
    building_age: result.building_age ?? null,
    parking: result.parking ?? false,
    elevator: result.elevator ?? false,
    storage: result.storage ?? false,
    owner_name: result.owner_name ?? null,
    owner_phone: result.owner_phone ?? null,
    description: result.description ?? null,
    notes: result.notes ?? null,
  };
}

/**
 * Creates a NEW file from a reading: the source image stays attached as a
 * private (admin-only) OCR image and every date/price pair on the sheet is
 * recorded as a price-history event — unconfirmed, so no guessed current price.
 */
export async function createFromOcr(options: {
  result: OcrResult;
  userId: string;
  image?: File | null;
  brokerId?: string | null;
}): Promise<{ id: string; fileCode: number | null }> {
  const input = ocrResultToInput(options.result);
  if (options.brokerId) input.broker_id = options.brokerId;

  let privatePath: string | null = null;
  if (options.image) {
    try {
      const [path] = await uploadPhotos([options.image], options.userId, "private_ocr");
      privatePath = path ?? null;
    } catch {
      privatePath = null;
    }
  }
  if (privatePath) input.private_photos = [privatePath];

  const id = await createProperty(input, options.userId);
  const property = await fetchProperty(id);

  const events = priceEventsOf(options.result)
    .slice()
    .sort((a, b) => (jalaliToISO(a.date ?? null) ?? "").localeCompare(jalaliToISO(b.date ?? null) ?? ""));
  for (const event of events) {
    await addPriceEvent(property, options.userId, {
      price: event.price ?? null,
      event_at: jalaliToISO(event.date ?? null),
      source: "ocr",
      confidence: "ocr",
      note: event.note ?? "ثبت گروهی از تصویر (OCR)",
      verify: false,
    });
  }

  return { id, fileCode: property.file_code };
}

/** Attaches an extra source image to an existing file (private, admin-only). */
export async function attachPrivateImage(propertyId: string, userId: string, image: File) {
  const [path] = await uploadPhotos([image], userId, "private_ocr");
  if (!path) return;
  const property = await fetchProperty(propertyId);
  const next = Array.from(new Set([...(property.private_photos ?? []), path]));
  const {
    id: _id,
    user_id: _userId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    file_code: _fileCode,
    initial_date: _initialDate,
    verified_price: _verifiedPrice,
    price_verified_at: _priceVerifiedAt,
    ...rest
  } = property;
  await updateProperty(propertyId, { ...rest, private_photos: next } as PropertyInput);
}
