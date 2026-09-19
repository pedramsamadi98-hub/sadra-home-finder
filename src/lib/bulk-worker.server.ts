/**
 * Shared processing core for the bulk-import queue.
 *
 * This is the EXACT logic that used to live inside `runBulkImportWorker`'s
 * handler, moved here unchanged so that both entry points reuse it:
 *   - `runBulkImportWorker` (manager-facing, auth + admin check)
 *   - `/api/public/hooks/bulk-import-worker` (scheduler, shared-secret check)
 *
 * It only drives the queue: claim → fetch image from storage → existing OCR
 * engine → existing matching core → persist result → release lease. It never
 * executes a manager decision (register/connect/defer).
 */

/** Max retries per item, mirroring the device queue (batch-store MAX_RETRIES). */
const MAX_RETRIES = 3;
/** Bounded invocation: a few items per call keeps well inside the request timeout. */
export const DEFAULT_LIMIT = 3;
const LEASE_SECONDS = 180;

export interface WorkerReport {
  claimed: number;
  processed: number;
  needsReview: number;
  manual: number;
  failed: number;
  /** No claimable item left — the caller can stop polling. */
  idle: boolean;
}

function backoffAt(retry: number): string {
  const minutes = Math.min(30, 2 ** retry); // 1, 2, 4, 8 … minutes
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function signalCount(ocr: Record<string, unknown>): number {
  return [
    "area",
    "address",
    "street",
    "neighborhood",
    "owner_phone",
    "owner_name",
    "plot_number",
    "title",
    "price",
  ].filter((key) => {
    const value = ocr[key];
    return value !== null && value !== undefined && String(value).trim() !== "";
  }).length;
}

export function boundedLimit(value: unknown): number {
  return Math.max(1, Math.min(Number(value ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 10));
}

export async function processBulkImportQueue(limit: number): Promise<WorkerReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { extractFromImageDataUrl } = await import("@/lib/ocr.server");
  const { findOcrCandidatesWith } = await import("@/lib/ocr-match-core");

  const worker = `worker-${crypto.randomUUID()}`;
  const report: WorkerReport = {
    claimed: 0,
    processed: 0,
    needsReview: 0,
    manual: 0,
    failed: 0,
    idle: false,
  };

  // Atomic claim with lease + fencing counter (claim_bulk_import_items).
  const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_bulk_import_items", {
    _worker: worker,
    _limit: limit,
    _lease_seconds: LEASE_SECONDS,
  });
  if (claimError) throw new Error(claimError.message);

  // The claim is global and oldest-first, so every claimed item is processed
  // here; filtering by batch would leave older items leased and idle.
  const items = claimed ?? [];
  report.claimed = items.length;
  if (!items.length) {
    report.idle = true;
    return report;
  }

  for (const item of items) {
    try {
      // Idempotency: never redo an item that already produced a property.
      if (item.property_id) {
        await supabaseAdmin
          .from("bulk_import_items")
          .update({ status: "done", lease_owner: null, lease_until: null })
          .eq("id", item.id)
          .eq("fence", item.fence);
        report.processed += 1;
        continue;
      }

      // One image at a time — the batch never lands in memory.
      const { data: file, error: downloadError } = await supabaseAdmin.storage
        .from("property-photos")
        .download(item.storage_path!);
      if (downloadError || !file) throw new Error(downloadError?.message ?? "دانلود تصویر ناموفق بود");

      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      // Storage can hand back application/octet-stream; the AI gateway needs a
      // real image mime type, so derive it from the stored file extension.
      const ext = (item.storage_path!.split(".").pop() ?? "jpg").toLowerCase();
      const mime =
        file.type && file.type.startsWith("image/")
          ? file.type
          : ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : "image/jpeg";
      const dataUrl = `data:${mime};base64,${btoa(binary)}`;

      const ocr = await extractFromImageDataUrl(dataUrl);
      const enough = signalCount(ocr as unknown as Record<string, unknown>) >= 2;
      const status = enough ? "needs_review" : "manual";

      // Same matching logic as the browser (shared core, narrow indexed
      // lookups only). Nothing is merged or registered here — the candidates
      // are stored for the existing review dialog to decide on later.
      let matching: {
        candidates: {
          property_id: string;
          file_code: number | null;
          title: string;
          score: number;
          confidence: string;
          reasons: string[];
        }[];
        top_confidence: string | null;
        matched_at: string;
      } | null = null;
      if (enough) {
        const candidates = await findOcrCandidatesWith(supabaseAdmin as never, ocr);
        matching = {
          candidates: candidates.map((candidate) => ({
            property_id: candidate.property.id,
            file_code: candidate.property.file_code ?? null,
            title: candidate.property.title,
            score: candidate.score,
            confidence: candidate.confidence,
            reasons: candidate.reasons,
          })),
          top_confidence: candidates[0]?.confidence ?? null,
          matched_at: new Date().toISOString(),
        };
      }

      // Fencing: the update only lands while we still hold this lease version.
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("bulk_import_items")
        .update({
          status,
          ocr_result: ocr as never,
          matching_result: matching as never,
          last_error: null,
          next_retry_at: null,
          lease_owner: null,
          lease_until: null,
        })
        .eq("id", item.id)
        .eq("fence", item.fence)
        .select("id");
      if (updateError) throw new Error(updateError.message);
      if (!updated?.length) continue; // lease was taken over by another worker

      report.processed += 1;
      if (enough) report.needsReview += 1;
      else report.manual += 1;
    } catch (error) {
      const retry = item.retry_count + 1;
      const exhausted = retry >= MAX_RETRIES;
      report.failed += 1;
      await supabaseAdmin
        .from("bulk_import_items")
        .update({
          status: exhausted ? "error" : "error_retry",
          retry_count: retry,
          next_retry_at: exhausted ? null : backoffAt(retry),
          last_error: error instanceof Error ? error.message : String(error),
          lease_owner: null,
          lease_until: null,
        })
        .eq("id", item.id)
        .eq("fence", item.fence);
    }
  }

  // Keep batch bookkeeping in step with the real item rows (bounded update).
  const batchIds = Array.from(new Set(items.map((item) => item.batch_id)));
  for (const batchId of batchIds) {
    const [{ count: pending }, { count: failedCount }] = await Promise.all([
      supabaseAdmin
        .from("bulk_import_items")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId)
        .in("status", ["pending", "processing", "error_retry"]),
      supabaseAdmin
        .from("bulk_import_items")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId)
        .eq("status", "error"),
    ]);
    await supabaseAdmin
      .from("bulk_import_batches")
      .update({
        status: (pending ?? 0) > 0 ? "active" : "done",
        last_processed_at: new Date().toISOString(),
        error_message: (failedCount ?? 0) > 0 ? `${failedCount} مورد با خطا` : null,
      })
      .eq("id", batchId);
  }

  return report;
}
