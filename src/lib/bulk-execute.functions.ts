/**
 * Executes decisions that the user ALREADY saved on bulk-import items.
 *
 * It never matches, never picks a candidate and never touches an item without an
 * explicit `decision`. Registration/linking rules are reused from the existing
 * browser flow (`ocrResultToInput`, `planChanges`, `priceEventsOf`) — nothing is
 * re-implemented here beyond writing with the server client.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";

const DEFAULT_LIMIT = 3;

export interface ExecuteReport {
  considered: number;
  registered: number;
  connected: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export const executeBulkImportDecisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { batchId?: string | null; limit?: number } | undefined) => ({
    batchId: data?.batchId ? String(data.batchId) : null,
    limit: Math.max(1, Math.min(Number(data?.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 5)),
  }))
  .handler(async ({ data, context }): Promise<ExecuteReport> => {
    await assertAdmin(context.supabase as never, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ocrResultToInput } = await import("@/lib/batch-import");
    const { planChanges, priceEventsOf, jalaliToISO } = await import("@/lib/ocr-match");

    const report: ExecuteReport = {
      considered: 0,
      registered: 0,
      connected: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    // Only explicitly decided, not-yet-executed items.
    let query = supabaseAdmin
      .from("bulk_import_items")
      .select("*")
      .in("decision", ["register_new", "connect_existing"])
      .is("property_id", null)
      .not("ocr_result", "is", null)
      .order("decided_at", { ascending: true })
      .limit(data.limit);
    if (data.batchId) query = query.eq("batch_id", data.batchId);

    const { data: items, error } = await query;
    if (error) throw new Error(error.message);
    report.considered = (items ?? []).length;

    for (const item of items ?? []) {
      try {
        // Single-runner guard: only the worker that flips this row proceeds.
        const { data: claimed, error: claimError } = await supabaseAdmin
          .from("bulk_import_items")
          .update({ status: "processing", fence: item.fence + 1, updated_at: new Date().toISOString() })
          .eq("id", item.id)
          .eq("fence", item.fence)
          .is("property_id", null)
          .select("id");
        if (claimError) throw new Error(claimError.message);
        if (!claimed?.length) {
          report.skipped += 1;
          continue;
        }

        const ocr = item.ocr_result as Record<string, unknown>;
        const tag = `[bulk:${item.id}]`;
        let propertyId: string | null = null;

        if (item.decision === "connect_existing") {
          if (!item.decision_property_id) throw new Error("ملک انتخاب‌شده مشخص نیست");
          const { data: property, error: propError } = await supabaseAdmin
            .from("properties")
            .select("*")
            .eq("id", item.decision_property_id)
            .single();
          if (propError || !property) throw new Error("ملک انتخاب‌شده پیدا نشد");

          // Fill only empty fields — never overwrite existing information.
          const fills = planChanges(property as never, ocr as never).filter((change) => !change.conflict);
          const patch: Record<string, unknown> = {};
          for (const change of fills) patch[change.key as string] = change.next;

          const privatePhotos = Array.from(
            new Set([...(property.private_photos ?? []), item.storage_path!]),
          );
          const { error: updateError } = await supabaseAdmin
            .from("properties")
            .update({ ...patch, private_photos: privatePhotos } as never)
            .eq("id", property.id);
          if (updateError) throw new Error(updateError.message);
          propertyId = property.id;
          report.connected += 1;
        } else {
          // register_new — the file code, initial date and initial price come from
          // the existing database trigger, never generated here.
          // Crash-safety: the stored image path is unique per item, so a property
          // already created from it is reused instead of duplicated.
          const { data: existing } = await supabaseAdmin
            .from("properties")
            .select("id")
            .contains("private_photos", [item.storage_path!])
            .limit(1);
          if (existing?.length) {
            propertyId = existing[0]!.id;
          } else {
            const input = ocrResultToInput(ocr as never);
            const { data: created, error: insertError } = await supabaseAdmin
              .from("properties")
              .insert({
                ...input,
                private_photos: [item.storage_path!],
                user_id: item.user_id,
              } as never)
              .select("id")
              .single();
            if (insertError || !created) throw new Error(insertError?.message ?? "ثبت ملک ناموفق بود");
            propertyId = created.id;
          }
          report.registered += 1;
        }

        // Price history, tagged with the item id so a retry never duplicates it.
        const { count: alreadyLogged } = await supabaseAdmin
          .from("property_price_events")
          .select("id", { count: "exact", head: true })
          .eq("property_id", propertyId)
          .like("note", `%${tag}%`);
        if (!alreadyLogged) {
          const events = priceEventsOf(ocr as never)
            .slice()
            .sort((a, b) =>
              (jalaliToISO(a.date ?? null) ?? "").localeCompare(jalaliToISO(b.date ?? null) ?? ""),
            );
          for (const event of events) {
            await supabaseAdmin.from("property_price_events").insert({
              property_id: propertyId,
              user_id: item.user_id,
              kind: "price",
              price: event.price ?? null,
              event_at: jalaliToISO(event.date ?? null) ?? new Date().toISOString(),
              source: "ocr",
              confidence: "ocr",
              note: `${event.note ?? "ثبت گروهی از تصویر (OCR)"} ${tag}`,
            } as never);
          }
        }

        // Attach the stored image to the file it now belongs to.
        await supabaseAdmin
          .from("photo_visibility")
          .update({ property_id: propertyId })
          .eq("storage_path", item.storage_path!);

        const { data: property } = await supabaseAdmin
          .from("properties")
          .select("file_code")
          .eq("id", propertyId)
          .single();

        await supabaseAdmin
          .from("bulk_import_items")
          .update({
            status: "done",
            property_id: propertyId,
            file_code: property?.file_code ?? null,
            last_error: null,
            lease_owner: null,
            lease_until: null,
          })
          .eq("id", item.id);
      } catch (executionError) {
        report.failed += 1;
        const message =
          executionError instanceof Error ? executionError.message : String(executionError);
        report.errors.push(message);
        await supabaseAdmin
          .from("bulk_import_items")
          .update({ status: "needs_review", last_error: message, lease_owner: null, lease_until: null })
          .eq("id", item.id);
      }
    }

    return report;
  });
