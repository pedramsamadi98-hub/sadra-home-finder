/**
 * Background scheduler entry point for the bulk-import queue worker.
 *
 * Service-to-service only: the caller must present the shared scheduler secret
 * (`BULK_IMPORT_SCHEDULER_SECRET`) as a Bearer token. Nothing is processed
 * before that check passes. It reuses the same processing core as the
 * manager-facing server function and never executes manager decisions
 * (register_new / connect_existing / defer).
 */

import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/bulk-import-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["BULK_IMPORT_SCHEDULER_SECRET"];
        if (!expected) return json({ error: "not_configured" }, 503);

        const header = request.headers.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (!token || !timingSafeEqual(token, expected)) {
          return json({ error: "unauthorized" }, 401);
        }

        const { processBulkImportQueue, boundedLimit } = await import("@/lib/bulk-worker.server");

        let limit: unknown;
        try {
          const body = (await request.json()) as { limit?: unknown } | null;
          limit = body?.limit;
        } catch {
          limit = undefined;
        }

        const report = await processBulkImportQueue(boundedLimit(limit));
        return json(report);
      },
    },
  },
});
