/**
 * Manager-facing entry point for the bulk-import queue worker.
 *
 * Auth/authorization only — the queue processing itself lives in the shared
 * core (`src/lib/bulk-worker.server.ts`), which the background scheduler route
 * reuses unchanged.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";
import type { WorkerReport } from "@/lib/bulk-worker.server";

export type { WorkerReport };

export const runBulkImportWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { batchId?: string | null; limit?: number } | undefined) => ({
    batchId: data?.batchId ? String(data.batchId) : null,
    limit: data?.limit,
  }))
  .handler(async ({ data, context }): Promise<WorkerReport> => {
    await assertAdmin(context.supabase as never, context.userId);
    const { processBulkImportQueue, boundedLimit } = await import("@/lib/bulk-worker.server");
    return processBulkImportQueue(boundedLimit(data.limit));
  });
