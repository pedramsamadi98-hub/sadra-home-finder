/**
 * Persistent store for the bulk-import queue.
 *
 * The queue used to live only in React state, so a refresh, a closed browser or
 * a phone that goes to sleep lost the whole batch. Everything now lives in
 * IndexedDB on the device: batch rows, per-item rows (status, retry count, OCR
 * result, linked property) and the source image blob. Nothing here touches the
 * database, storage, auth or RLS.
 *
 * Design notes:
 * - Image blobs stay on disk and are read one at a time, so a 50,000 image
 *   batch never lands in browser memory.
 * - The UI reads one page of items at a time plus cheap per-status counts.
 * - Items are claimed before processing (worker id + timestamp) so two open
 *   tabs never process the same image; stale claims are released on load.
 * - An item that reached `done` / `linked` / `duplicate` is never re-processed,
 *   which makes resume idempotent: no duplicate property, no duplicate file code.
 */

import type { BatchItem, BatchStatus } from "@/lib/batch-import";
import type { OcrResult } from "@/lib/ocr.functions";
import type { OcrCandidate } from "@/lib/ocr-match";

const DB_NAME = "sadra-bulk-import";
const DB_VERSION = 1;
const BATCHES = "batches";
const ITEMS = "items";

/** A claim older than this is considered dead (tab closed mid-item). */
const CLAIM_TTL_MS = 3 * 60 * 1000;
/** Controlled retry: an item never loops forever. */
export const MAX_RETRIES = 3;

export interface StoredBatch {
  id: string;
  status: "active" | "paused" | "done";
  total: number;
  created_at: number;
  updated_at: number;
  last_processed_at: number | null;
  /** Non-image ZIP entries that were skipped on purpose. */
  skipped: string[];
  error_message: string | null;
  /** Reviewed items the manager hid from the active queue (kept on device). */
  dismissed_count?: number;
}

export interface StoredItem extends BatchItem {
  batch_id: string;
  retry_count: number;
  ocr: OcrResult | null;
  candidates: OcrCandidate[] | null;
  blob: Blob | null;
  created_at: number;
  updated_at: number;
  claimed_by: string | null;
  claimed_at: number | null;
  /**
   * Hidden from the active queue after review. The row, its OCR result, the
   * linked property id and the file code all stay exactly as they were; only
   * the queue view skips it and the worker never claims it again.
   */
  dismissed?: boolean;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BATCHES)) {
        db.createObjectStore(BATCHES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(ITEMS)) {
        const store = db.createObjectStore(ITEMS, { keyPath: "id" });
        store.createIndex("batch_id", "batch_id");
        store.createIndex("batch_status", ["batch_id", "status"]);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB failed"));
  });
  return dbPromise;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB request failed"));
  });
}

function tx(db: IDBDatabase, stores: string[], mode: IDBTransactionMode) {
  return db.transaction(stores, mode);
}

/* --------------------------------- batches -------------------------------- */

export async function createBatch(total: number, skipped: string[]): Promise<StoredBatch> {
  const db = await openDb();
  const now = Date.now();
  const batch: StoredBatch = {
    id: crypto.randomUUID(),
    status: "active",
    total,
    created_at: now,
    updated_at: now,
    last_processed_at: null,
    skipped,
    error_message: null,
  };
  await done(tx(db, [BATCHES], "readwrite").objectStore(BATCHES).put(batch));
  return batch;
}

export async function listBatches(): Promise<StoredBatch[]> {
  const db = await openDb();
  const all = await done<StoredBatch[]>(
    tx(db, [BATCHES], "readonly").objectStore(BATCHES).getAll() as IDBRequest<StoredBatch[]>,
  );
  return all.sort((a, b) => b.created_at - a.created_at);
}

export async function getBatch(id: string): Promise<StoredBatch | null> {
  const db = await openDb();
  const row = await done<StoredBatch | undefined>(
    tx(db, [BATCHES], "readonly").objectStore(BATCHES).get(id) as IDBRequest<
      StoredBatch | undefined
    >,
  );
  return row ?? null;
}

export async function patchBatch(id: string, next: Partial<StoredBatch>): Promise<void> {
  const db = await openDb();
  const store = tx(db, [BATCHES], "readwrite").objectStore(BATCHES);
  const row = await done<StoredBatch | undefined>(
    store.get(id) as IDBRequest<StoredBatch | undefined>,
  );
  if (!row) return;
  await done(store.put({ ...row, ...next, updated_at: Date.now() }));
}

export async function deleteBatch(id: string): Promise<void> {
  const db = await openDb();
  const transaction = tx(db, [BATCHES, ITEMS], "readwrite");
  const keys = await done<IDBValidKey[]>(
    transaction.objectStore(ITEMS).index("batch_id").getAllKeys(id) as IDBRequest<IDBValidKey[]>,
  );
  const items = transaction.objectStore(ITEMS);
  for (const key of keys) items.delete(key);
  transaction.objectStore(BATCHES).delete(id);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("delete failed"));
  });
}

/* ---------------------------------- items --------------------------------- */

export interface NewItem {
  name: string;
  folder: string;
  size: number;
  source: "file" | "zip";
  zipName?: string;
  blob: Blob | null;
  status?: BatchStatus;
  error?: string | null;
}

/** Writes items in small chunks so a huge ZIP never blocks one transaction. */
export async function addItems(batchId: string, incoming: NewItem[]): Promise<void> {
  const db = await openDb();
  const CHUNK = 100;
  for (let start = 0; start < incoming.length; start += CHUNK) {
    const slice = incoming.slice(start, start + CHUNK);
    const transaction = tx(db, [ITEMS], "readwrite");
    const store = transaction.objectStore(ITEMS);
    const now = Date.now();
    for (const entry of slice) {
      const item: StoredItem = {
        id: crypto.randomUUID(),
        batch_id: batchId,
        name: entry.name,
        folder: entry.folder,
        size: entry.size,
        source: entry.source,
        ...(entry.zipName ? { zipName: entry.zipName } : {}),
        status: entry.status ?? "pending",
        error: entry.error ?? null,
        retry_count: 0,
        ocr: null,
        candidates: null,
        blob: entry.blob,
        propertyId: null,
        fileCode: null,
        hash: null,
        created_at: now,
        updated_at: now,
        claimed_by: null,
        claimed_at: null,
      };
      store.put(item);
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("write failed"));
    });
  }
  const batch = await getBatch(batchId);
  if (batch) await patchBatch(batchId, { total: batch.total + incoming.length });
}

export async function getItem(id: string): Promise<StoredItem | null> {
  const db = await openDb();
  const row = await done<StoredItem | undefined>(
    tx(db, [ITEMS], "readonly").objectStore(ITEMS).get(id) as IDBRequest<StoredItem | undefined>,
  );
  return row ?? null;
}

export async function patchItem(id: string, next: Partial<StoredItem>): Promise<void> {
  const db = await openDb();
  const store = tx(db, [ITEMS], "readwrite").objectStore(ITEMS);
  const row = await done<StoredItem | undefined>(
    store.get(id) as IDBRequest<StoredItem | undefined>,
  );
  if (!row) return;
  await done(store.put({ ...row, ...next, updated_at: Date.now() }));
}

/**
 * Marks a reviewed item as handled: it leaves the active queue but nothing is
 * deleted — no property, no photo, no price history, no file code.
 */
export async function dismissItem(id: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, [ITEMS], "readwrite").objectStore(ITEMS);
  const row = await done<StoredItem | undefined>(
    store.get(id) as IDBRequest<StoredItem | undefined>,
  );
  if (!row || row.dismissed) return;
  await done(store.put({ ...row, dismissed: true, updated_at: Date.now() }));
  const batch = await getBatch(row.batch_id);
  if (batch) await patchBatch(row.batch_id, { dismissed_count: (batch.dismissed_count ?? 0) + 1 });
}

export async function deleteItem(id: string): Promise<void> {
  const db = await openDb();
  await done(tx(db, [ITEMS], "readwrite").objectStore(ITEMS).delete(id));
}

const COUNTED: BatchStatus[] = [
  "pending",
  "ocr",
  "review",
  "manual",
  "duplicate",
  "linked",
  "done",
  "error",
];

export async function countsFor(batchId: string): Promise<Record<BatchStatus, number>> {
  const db = await openDb();
  const index = tx(db, [ITEMS], "readonly").objectStore(ITEMS).index("batch_status");
  const entries = await Promise.all(
    COUNTED.map(async (status) => [status, await done(index.count([batchId, status]))] as const),
  );
  return Object.fromEntries(entries) as Record<BatchStatus, number>;
}

/** One page of items, without the image blobs, so the UI stays light. */
export async function pageItems(
  batchId: string,
  page: number,
  size: number,
): Promise<{ rows: BatchItem[]; total: number }> {
  const db = await openDb();
  const transaction = tx(db, [ITEMS], "readonly");
  const store = transaction.objectStore(ITEMS);
  const keys = await done<IDBValidKey[]>(
    store.index("batch_id").getAllKeys(batchId) as IDBRequest<IDBValidKey[]>,
  );
  const rows: BatchItem[] = [];
  const skip = (page - 1) * size;
  let seen = 0;
  for (const key of keys) {
    if (rows.length >= size) break;
    const row = await done<StoredItem | undefined>(
      store.get(key) as IDBRequest<StoredItem | undefined>,
    );
    if (!row || row.dismissed) continue;
    seen += 1;
    if (seen <= skip) continue;
    rows.push({
      id: row.id,
      name: row.name,
      folder: row.folder,
      size: row.size,
      source: row.source,
      ...(row.zipName ? { zipName: row.zipName } : {}),
      status: row.status,
      error: row.error ?? null,
      ...(row.candidates ? { candidateCount: row.candidates.length } : {}),
      propertyId: row.propertyId ?? null,
      fileCode: row.fileCode ?? null,
      hash: row.hash ?? null,
    });
  }
  const batch = await getBatch(batchId);
  return { rows, total: Math.max(0, keys.length - (batch?.dismissed_count ?? 0)) };
}

/** Frees items a dead tab left mid-processing so resume can pick them up. */
export async function releaseStale(batchId: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, [ITEMS], "readwrite").objectStore(ITEMS);
  const stuck = await done<StoredItem[]>(
    store.index("batch_status").getAll([batchId, "ocr" satisfies BatchStatus]) as IDBRequest<
      StoredItem[]
    >,
  );
  const now = Date.now();
  for (const row of stuck) {
    if (row.claimed_at && now - row.claimed_at < CLAIM_TTL_MS) continue;
    store.put({ ...row, status: "pending", claimed_by: null, claimed_at: null, updated_at: now });
  }
}

/**
 * Claims the next processable item for this worker. The read + write happen in
 * one transaction, so a second tab can never claim the same row.
 */
export async function claimNext(batchId: string, workerId: string): Promise<StoredItem | null> {
  const db = await openDb();
  const transaction = tx(db, [ITEMS], "readwrite");
  const store = transaction.objectStore(ITEMS);
  const pending = await done<StoredItem[]>(
    store.index("batch_status").getAll([batchId, "pending" satisfies BatchStatus], 5) as IDBRequest<
      StoredItem[]
    >,
  );
  const row = pending.find((candidate) => !candidate.dismissed);
  if (!row) return null;
  const claimed: StoredItem = {
    ...row,
    status: "ocr",
    error: null,
    claimed_by: workerId,
    claimed_at: Date.now(),
    updated_at: Date.now(),
  };
  await done(store.put(claimed));
  return claimed;
}

/**
 * A bounded slice of still-pending items (with their image blob), used to mirror
 * the device queue into the server-side queue. Claims are not touched.
 */
export async function pendingItems(batchId: string, limit: number): Promise<StoredItem[]> {
  const db = await openDb();
  const store = tx(db, [ITEMS], "readonly").objectStore(ITEMS);
  const rows = await done<StoredItem[]>(
    store
      .index("batch_status")
      .getAll([batchId, "pending" satisfies BatchStatus], limit) as IDBRequest<StoredItem[]>,
  );
  return rows.filter((row) => row.blob && !row.dismissed);
}

/** Puts failed items back in line, respecting the retry cap. */
export async function resetErrors(batchId: string): Promise<number> {
  const db = await openDb();
  const store = tx(db, [ITEMS], "readwrite").objectStore(ITEMS);
  const failed = await done<StoredItem[]>(
    store.index("batch_status").getAll([batchId, "error" satisfies BatchStatus]) as IDBRequest<
      StoredItem[]
    >,
  );
  let queued = 0;
  const now = Date.now();
  for (const row of failed) {
    if (row.dismissed) continue;
    if (row.retry_count >= MAX_RETRIES) continue;
    if (!row.blob) continue;
    store.put({
      ...row,
      status: "pending",
      error: null,
      retry_count: row.retry_count + 1,
      claimed_by: null,
      claimed_at: null,
      updated_at: now,
    });
    queued += 1;
  }
  return queued;
}
