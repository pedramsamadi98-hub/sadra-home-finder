/**
 * Thin bridge between the existing bulk-import UI and the server-side queue
 * tables (`bulk_import_batches` / `bulk_import_items`).
 *
 * It only creates rows and reads status; OCR, matching, registration, file
 * codes and price history stay exactly where they are. The device IndexedDB
 * queue remains the primary path — this is an optional, additive mirror, so a
 * failure here never blocks the local flow.
 */

import { supabase } from "@/integrations/supabase/client";
import { uploadPhotos } from "@/lib/properties";

export const SERVER_STATUSES = [
  "pending",
  "processing",
  "needs_review",
  "manual",
  "error_retry",
  "error",
  "done",
] as const;

export type ServerStatus = (typeof SERVER_STATUSES)[number];

export const SERVER_STATUS_LABELS: Record<ServerStatus, string> = {
  pending: "در انتظار سرور",
  processing: "در حال پردازش سرور",
  needs_review: "آماده بررسی",
  manual: "نیازمند بررسی دستی",
  error_retry: "در انتظار تلاش دوباره",
  error: "خطا",
  done: "ثبت شد",
};

export interface ServerQueueItem {
  name: string;
  folder: string;
  size: number;
  source: "file" | "zip";
  hash?: string | null;
  file: File;
}

/** Creates the server-side batch row. */
export async function createServerBatch(userId: string, skipped: string[]): Promise<string> {
  const { data, error } = await supabase
    .from("bulk_import_batches")
    .insert({ user_id: userId, total: 0, skipped })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Uploads each image once (reusing the existing private-photo upload) and
 * inserts the queue rows in one statement per chunk — no N+1 inserts, and the
 * worker later reads the image straight from storage.
 */
export async function pushServerItems(
  batchId: string,
  userId: string,
  entries: ServerQueueItem[],
): Promise<number> {
  let inserted = 0;
  const CHUNK = 25;
  for (let start = 0; start < entries.length; start += CHUNK) {
    const slice = entries.slice(start, start + CHUNK);
    const rows: Record<string, unknown>[] = [];
    for (const entry of slice) {
      const [path] = await uploadPhotos([entry.file], userId, "private_ocr");
      if (!path) continue;
      rows.push({
        batch_id: batchId,
        user_id: userId,
        name: entry.name,
        folder: entry.folder,
        size: entry.size,
        source: entry.source,
        storage_path: path,
        image_hash: entry.hash ?? null,
        // Unique per stored object: re-running the worker can never register twice.
        idempotency_key: `${batchId}:${path}`,
      });
    }
    if (!rows.length) continue;
    const { error } = await supabase.from("bulk_import_items").insert(rows as never);
    if (error) throw error;
    inserted += rows.length;
  }
  if (inserted) {
    const { count } = await supabase
      .from("bulk_import_items")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId);
    await supabase
      .from("bulk_import_batches")
      .update({ total: count ?? inserted })
      .eq("id", batchId);
  }
  return inserted;
}

/** Cheap per-status counts (head-only) — never pulls the item rows. */
export async function serverCounts(batchId: string): Promise<Record<ServerStatus, number>> {
  const results = await Promise.all(
    SERVER_STATUSES.map(async (status) => {
      const { count } = await supabase
        .from("bulk_import_items")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId)
        .eq("status", status);
      return [status, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(results) as Record<ServerStatus, number>;
}

export async function deleteServerBatch(batchId: string): Promise<void> {
  const { error } = await supabase.from("bulk_import_batches").delete().eq("id", batchId);
  if (error) throw error;
}

export interface ServerMatchCandidate {
  property_id: string;
  file_code: number | null;
  title: string;
  score: number;
  confidence: string;
  reasons: string[];
}

/** Explicit user decisions recorded on a queue item. Recording ≠ executing. */
export type ServerDecision = "register_new" | "connect_existing" | "defer";

export const SERVER_DECISION_LABELS: Record<ServerDecision, string> = {
  register_new: "ثبت ملک جدید",
  connect_existing: "اتصال به ملک موجود",
  defer: "بعداً بررسی شود",
};

export interface ServerMatchItem {
  id: string;
  name: string;
  status: string;
  candidates: ServerMatchCandidate[];
  top_confidence: string | null;
  decision: ServerDecision | null;
  decision_property_id: string | null;
}

/**
 * Records the user's choice on a server queue item — nothing else. No property
 * is created, updated or linked, no price history, no photo, no file code; a
 * separate later step executes the decision.
 */
export async function saveServerDecision(
  itemId: string,
  decision: ServerDecision,
  propertyId?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("bulk_import_items")
    .update({
      decision,
      decision_property_id: decision === "connect_existing" ? (propertyId ?? null) : null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", itemId);
  if (error) throw error;
}

/**
 * Read-only view of the worker's stored matching results for the UI.
 * Never writes, merges or registers anything — the final link decision stays
 * with the existing review flow.
 */
export async function serverMatchingResults(
  batchId: string,
  limit = 25,
): Promise<ServerMatchItem[]> {
  const { data, error } = await supabase
    .from("bulk_import_items")
    .select("id, name, status, matching_result")
    .eq("batch_id", batchId)
    .not("matching_result", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const result = (row.matching_result ?? {}) as {
      candidates?: ServerMatchCandidate[];
      top_confidence?: string | null;
    };
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      candidates: result.candidates ?? [],
      top_confidence: result.top_confidence ?? null,
    };
  });
}
