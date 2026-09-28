import { createServerFn } from "@tanstack/react-start";

import { assertAdmin } from "@/lib/admin-guard.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BACKUP_BUCKETS, BACKUP_FORMAT_VERSION, BACKUP_TABLES, type BackupTable } from "@/lib/backup.functions";

/**
 * Restore V1 — CHECK + DRY RUN ONLY. Every operation here is read-only:
 * no insert/update/delete/upsert and no Storage upload. Apply is not implemented.
 */

const PK: Record<BackupTable, string> = {
  profiles: "id",
  user_roles: "id",
  app_settings: "user_id",
  brokers: "id",
  customers: "id",
  customer_requirements: "id",
  properties: "id",
  property_price_events: "id",
  photo_visibility: "storage_path",
  property_shares: "id",
  follow_ups: "id",
  file_code_pool: "code",
  bulk_import_batches: "id",
  bulk_import_items: "id",
};

/** Columns intentionally absent from backups; ignored when comparing. */
const OMITTED: Partial<Record<BackupTable, string[]>> = { property_shares: ["token_hash"] };

/** column -> parent table (nullable FKs are skipped when null). */
const FKS: Partial<Record<BackupTable, Array<[string, BackupTable]>>> = {
  user_roles: [["user_id", "profiles"]],
  app_settings: [["user_id", "profiles"]],
  customer_requirements: [["customer_id", "customers"]],
  properties: [["broker_id", "brokers"]],
  property_price_events: [["property_id", "properties"]],
  photo_visibility: [["property_id", "properties"]],
  property_shares: [
    ["property_id", "properties"],
    ["customer_id", "customers"],
  ],
  follow_ups: [
    ["property_id", "properties"],
    ["customer_id", "customers"],
    ["broker_id", "brokers"],
  ],
  bulk_import_items: [["batch_id", "bulk_import_batches"]],
};

type Input = {
  /** Raw manifest.json and checksums.txt text — parsed and cross-checked on the server. */
  manifest_text: string;
  checksums_text: string;
  tables: Record<string, { jsonl: string }>;
  /** Photo bytes are verified in the browser; the server cross-checks this list against manifest + checksums. */
  photos: Array<{ bucket: string; path: string; sha256: string; size: number }>;
};

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

function safePath(path: string) {
  return (
    !!path &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    path.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..")
  );
}

export type TableReport = {
  table: string;
  backup_rows: number;
  insert: number;
  identical: number;
  conflicts: Array<{ id: string; reason: string }>;
  not_restorable: number;
  unknown_columns: string[];
  missing_columns: string[];
  fk_errors: string[];
};

export type PhotoReport = {
  path: string;
  size: number;
  action: "upload" | "identical" | "conflict";
  reason?: string;
};

export const previewRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => {
    if (!data || typeof data !== "object" || !data.tables || !Array.isArray(data.photos)) {
      throw new Error("ورودی نامعتبر");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const errors: string[] = [];

    if (data.manifest.backup_format_version !== BACKUP_FORMAT_VERSION) errors.push("نسخه فرمت پشتیبان پشتیبانی نمی‌شود");
    if (data.manifest.project_identifier !== "sadra-melk") errors.push("شناسه پروژه مطابقت ندارد");

    // Live schema (read-only OpenAPI description of the REST API).
    let schema: Record<string, string[]> = {};
    try {
      const url = process.env["SUPABASE_URL"]!;
      const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
      const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Accept: "application/openapi+json" } });
      const spec = (await res.json()) as { definitions?: Record<string, { properties?: Record<string, unknown> }> };
      schema = Object.fromEntries(
        Object.entries(spec.definitions ?? {}).map(([name, def]) => [name, Object.keys(def.properties ?? {})]),
      );
    } catch {
      errors.push("ساختار فعلی دیتابیس خوانده نشد");
    }

    // Parse + re-verify table checksums server-side.
    const rows: Record<string, Array<Record<string, unknown>>> = {};
    for (const table of BACKUP_TABLES) {
      const entry = data.tables[table];
      if (!entry) {
        errors.push(`فایل جدول ${table} وجود ندارد`);
        rows[table] = [];
        continue;
      }
      if ((await sha256Hex(new TextEncoder().encode(entry.jsonl))) !== entry.sha256) {
        errors.push(`checksum جدول ${table} در سرور مطابقت ندارد`);
      }
      try {
        rows[table] = entry.jsonl.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
      } catch {
        errors.push(`JSONL جدول ${table} خراب است`);
        rows[table] = [];
      }
    }

    // Live keys per table (for FK and existence checks).
    const liveRows: Record<string, Map<string, Record<string, unknown>>> = {};
    const reports: TableReport[] = [];

    for (const table of BACKUP_TABLES) {
      const pk = PK[table];
      const omit = OMITTED[table] ?? [];
      const backupRows = rows[table] ?? [];
      const liveCols = schema[table] ?? [];
      const backupCols = new Set(backupRows.flatMap((r) => Object.keys(r)));
      const report: TableReport = {
        table,
        backup_rows: backupRows.length,
        insert: 0,
        identical: 0,
        conflicts: [],
        not_restorable: 0,
        unknown_columns: liveCols.length ? [...backupCols].filter((c) => !liveCols.includes(c)) : [],
        missing_columns: backupRows.length
          ? liveCols.filter((c) => !backupCols.has(c) && !omit.includes(c))
          : [],
        fk_errors: [],
      };
      if (!liveCols.length) errors.push(`جدول ${table} در دیتابیس فعلی پیدا نشد`);

      const live = new Map<string, Record<string, unknown>>();
      const ids = backupRows.map((r) => r[pk]).filter((v) => v !== null && v !== undefined);
      if (ids.length !== backupRows.length) errors.push(`جدول ${table}: ردیف بدون کلید`);
      for (let i = 0; i < ids.length; i += 200) {
        const { data: found, error } = await supabaseAdmin
          .from(table)
          .select("*")
          .in(pk, ids.slice(i, i + 200) as never[]);
        if (error) throw new Error(`${table}: ${error.message}`);
        for (const r of (found ?? []) as Array<Record<string, unknown>>) live.set(String(r[pk]), r);
      }
      liveRows[table] = live;

      for (const row of backupRows) {
        const id = String(row[pk]);
        const existing = live.get(id);
        if (!existing) {
          if (table === "property_shares") report.not_restorable += 1; // token_hash not in backup
          else report.insert += 1;
          continue;
        }
        const cmp = { ...existing };
        for (const k of omit) delete cmp[k];
        if (canonical(cmp) === canonical(row)) report.identical += 1;
        else {
          const diff = Object.keys({ ...cmp, ...row }).filter((k) => canonical(cmp[k]) !== canonical(row[k]));
          report.conflicts.push({ id, reason: `محتوای متفاوت: ${diff.join("، ")}` });
        }
      }
      reports.push(report);
    }

    // Extra unique checks for rows that would be inserted.
    const propReport = reports.find((r) => r.table === "properties")!;
    const newProps = (rows["properties"] ?? []).filter((r) => !liveRows["properties"]!.has(String(r["id"])) && r["file_code"] != null);
    for (let i = 0; i < newProps.length; i += 200) {
      const chunk = newProps.slice(i, i + 200);
      const { data: taken, error } = await supabaseAdmin
        .from("properties")
        .select("id, file_code")
        .in("file_code", chunk.map((r) => r["file_code"]) as number[]);
      if (error) throw new Error(`properties: ${error.message}`);
      for (const t of taken ?? []) {
        propReport.conflicts.push({ id: String(t.id), reason: `کد فایل ${t.file_code} قبلاً به ملک دیگری داده شده` });
        propReport.insert -= 1;
      }
    }

    // FK checks: parent must exist in backup or in the live DB.
    for (const table of BACKUP_TABLES) {
      const fks = FKS[table];
      if (!fks) continue;
      const report = reports.find((r) => r.table === table)!;
      for (const [col, parent] of fks) {
        const inBackup = new Set((rows[parent] ?? []).map((r) => String(r[PK[parent]])));
        const missing = new Set<string>();
        for (const row of rows[table] ?? []) {
          const v = row[col];
          if (v !== null && v !== undefined && !inBackup.has(String(v))) missing.add(String(v));
        }
        if (missing.size) {
          const { data: found } = await supabaseAdmin
            .from(parent)
            .select(PK[parent])
            .in(PK[parent], [...missing] as never[]);
          for (const f of (found ?? []) as unknown as Array<Record<string, unknown>>) missing.delete(String(f[PK[parent]]));
        }
        for (const m of missing) report.fk_errors.push(`${col} → ${parent}: ${m}`);
      }
    }
    // profiles must point to existing login accounts.
    const profReport = reports.find((r) => r.table === "profiles")!;
    for (const p of rows["profiles"] ?? []) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(String(p["id"]));
      if (!user?.user) profReport.fk_errors.push(`id → auth user: ${String(p["id"])}`);
    }

    // Storage: path-authoritative comparison, read-only.
    const photos: PhotoReport[] = [];
    for (const bucket of BACKUP_BUCKETS) {
      const { error } = await supabaseAdmin.storage.getBucket(bucket);
      if (error) errors.push(`باکت ${bucket} وجود ندارد`);
    }
    for (const photo of data.photos) {
      if (!(BACKUP_BUCKETS as readonly string[]).includes(photo.bucket) || !safePath(photo.path)) {
        errors.push(`مسیر عکس ناامن: ${photo.path}`);
        continue;
      }
      const slash = photo.path.lastIndexOf("/");
      const folder = slash >= 0 ? photo.path.slice(0, slash) : "";
      const name = photo.path.slice(slash + 1);
      const { data: listed, error } = await supabaseAdmin.storage
        .from(photo.bucket)
        .list(folder, { search: name, limit: 100 });
      if (error) throw new Error(`${photo.path}: ${error.message}`);
      if (!(listed ?? []).some((e) => e.name === name && e.id !== null)) {
        photos.push({ path: photo.path, size: photo.size, action: "upload" });
        continue;
      }
      const { data: file, error: dlError } = await supabaseAdmin.storage.from(photo.bucket).download(photo.path);
      if (dlError || !file) throw new Error(`${photo.path}: ${dlError?.message ?? "download failed"}`);
      const liveHash = await sha256Hex(new Uint8Array(await file.arrayBuffer()));
      photos.push(
        liveHash === photo.sha256
          ? { path: photo.path, size: photo.size, action: "identical" }
          : { path: photo.path, size: photo.size, action: "conflict", reason: "همان مسیر با محتوای متفاوت" },
      );
    }

    for (const r of reports) {
      if (r.unknown_columns.length) errors.push(`جدول ${r.table}: ستون ناشناخته ${r.unknown_columns.join("، ")}`);
      if (r.missing_columns.length) errors.push(`جدول ${r.table}: ستون‌های جاافتاده ${r.missing_columns.join("، ")}`);
      if (r.fk_errors.length) errors.push(`جدول ${r.table}: ${r.fk_errors.length} ارتباط نامعتبر`);
    }

    const conflictCount =
      reports.reduce((s, r) => s + r.conflicts.length, 0) + photos.filter((p) => p.action === "conflict").length;
    const status = errors.length ? "INVALID_BACKUP" : conflictCount ? "BLOCKED_BY_CONFLICTS" : "SAFE_TO_APPLY";
    return { status, errors, tables: reports, photos, conflict_count: conflictCount };
  });
