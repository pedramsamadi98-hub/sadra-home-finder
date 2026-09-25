import { createServerFn } from "@tanstack/react-start";

import { assertAdmin } from "@/lib/admin-guard.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Business-critical tables included in a data backup, in dependency order so a
 * future staged restore can insert parents before children.
 * Excluded on purpose: auth users/credentials, secrets, storage objects.
 */
export const BACKUP_TABLES = [
  "profiles",
  "user_roles",
  "app_settings",
  "brokers",
  "customers",
  "customer_requirements",
  "properties",
  "property_price_events",
  "photo_visibility",
  "property_shares",
  "follow_ups",
  "file_code_pool",
  "bulk_import_batches",
  "bulk_import_items",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Columns never exported (credential-like values). */
const OMITTED_COLUMNS: Partial<Record<BackupTable, string[]>> = {
  property_shares: ["token_hash"],
};

export const BACKUP_FORMAT_VERSION = 1;

const PAGE_SIZE = 1000;

export const getBackupCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const counts: Record<string, number> = {};
    for (const table of BACKUP_TABLES) {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw new Error(`${table}: ${error.message}`);
      counts[table] = count ?? 0;
    }
    return { counts, total: Object.values(counts).reduce((sum, n) => sum + n, 0) };
  });

/** Reads one table fully (paged) and returns its rows as JSONL text. */
export const getBackupTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { table: string }) => {
    const table = String(data?.table ?? "");
    if (!(BACKUP_TABLES as readonly string[]).includes(table)) {
      throw new Error("جدول مجاز نیست");
    }
    return { table: table as BackupTable };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const omit = OMITTED_COLUMNS[data.table] ?? [];
    const lines: string[] = [];
    let from = 0;

    for (;;) {
      const { data: rows, error } = await supabaseAdmin
        .from(data.table)
        .select("*")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`${data.table}: ${error.message}`);
      const page = (rows ?? []) as Array<Record<string, unknown>>;
      for (const row of page) {
        if (omit.length) for (const key of omit) delete row[key];
        lines.push(JSON.stringify(row));
      }
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return { table: data.table, count: lines.length, jsonl: lines.length ? lines.join("\n") + "\n" : "" };
  });

// ---------------------------------------------------------------------------
// Phase 2 — Storage (photos). Read-only: list + download only.
// ---------------------------------------------------------------------------

export const BACKUP_BUCKETS = ["property-photos"] as const;

export type StorageObjectInfo = {
  bucket: string;
  path: string;
  size: number;
  content_type: string | null;
  updated_at: string | null;
  references: string[];
};

type AdminClient = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function listAll(admin: AdminClient, bucket: string, prefix: string, out: StorageObjectInfo[]) {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    const entries = data ?? [];
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        await listAll(admin, bucket, path, out); // folder
      } else if (entry.name !== ".emptyFolderPlaceholder") {
        const meta = (entry.metadata ?? {}) as { size?: number; mimetype?: string };
        out.push({
          bucket,
          path,
          size: Number(meta.size ?? 0),
          content_type: meta.mimetype ?? null,
          updated_at: entry.updated_at ?? null,
          references: [],
        });
      }
    }
    if (entries.length < 1000) break;
  }
}

/** Lists every Storage object that belongs in the backup, with reference info. */
export const getBackupStorageList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const objects: StorageObjectInfo[] = [];
    for (const bucket of BACKUP_BUCKETS) await listAll(supabaseAdmin, bucket, "", objects);

    const refs = new Map<string, string[]>();
    const add = (path: string | null | undefined, ref: string) => {
      if (!path) return;
      refs.set(path, [...(refs.get(path) ?? []), ref]);
    };
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from("properties")
        .select("id, photos, private_photos")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`properties: ${error.message}`);
      for (const row of data ?? []) {
        for (const p of row.photos ?? []) add(p, `properties.photos:${row.id}`);
        for (const p of row.private_photos ?? []) add(p, `properties.private_photos:${row.id}`);
      }
      if ((data ?? []).length < PAGE_SIZE) break;
    }
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("bulk_import_items")
      .select("id, storage_path");
    if (itemsError) throw new Error(`bulk_import_items: ${itemsError.message}`);
    for (const row of items ?? []) add(row.storage_path, `bulk_import_items:${row.id}`);

    for (const obj of objects) obj.references = refs.get(obj.path) ?? [];
    return {
      objects,
      total_bytes: objects.reduce((sum, o) => sum + o.size, 0),
    };
  });

/** Downloads one Storage object (read-only) and returns it as base64 plus its SHA-256. */
export const getBackupStorageObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bucket: string; path: string }) => {
    const bucket = String(data?.bucket ?? "");
    const path = String(data?.path ?? "");
    if (!(BACKUP_BUCKETS as readonly string[]).includes(bucket)) throw new Error("باکت مجاز نیست");
    if (!path || path.includes("..")) throw new Error("مسیر نامعتبر");
    return { bucket, path };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error } = await supabaseAdmin.storage.from(data.bucket).download(data.path);
    if (error || !file) throw new Error(`${data.path}: ${error?.message ?? "download failed"}`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { path: data.path, size: bytes.byteLength, sha256, base64: Buffer.from(bytes).toString("base64") };
  });
