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
