import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  FileArchive,
  Images,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AdminOnly } from "@/components/AdminOnly";
import { AppShell } from "@/components/AppShell";
import { OcrMatchDialog } from "@/components/OcrMatchDialog";
import { Button } from "@/components/ui/button";
import { faDigits } from "@/lib/fa";
import {
  attachPrivateImage,
  BATCH_STATUS_LABELS,
  BATCH_STATUS_TONE,
  createFromOcr,
  expandZip,
  hasEnoughData,
  hashFile,
  isImageName,
  loadHashLedger,
  saveHashLedger,
  type BatchItem,
  type BatchStatus,
} from "@/lib/batch-import";
import {
  addItems,
  claimNext,
  countsFor,
  createBatch,
  deleteBatch,
  deleteItem,
  getItem,
  listBatches,
  MAX_RETRIES,
  pageItems,
  patchBatch,
  patchItem,
  pendingItems,
  releaseStale,
  resetErrors,
  type NewItem,
  type StoredBatch,
} from "@/lib/batch-store";
import { runBulkImportWorker } from "@/lib/bulk-worker.functions";
import {
  createServerBatch,
  pushServerItems,
  serverCounts,
  serverMatchingResults,
  saveServerDecision,
  SERVER_DECISION_LABELS,
  SERVER_STATUS_LABELS,
  SERVER_STATUSES,
  type ServerDecision,
  type ServerMatchItem,
  type ServerStatus,
} from "@/lib/bulk-queue";
import { extractPropertyFromImage, type OcrResult } from "@/lib/ocr.functions";
import { findOcrCandidates } from "@/lib/ocr-match";
import { fileCodeText } from "@/lib/properties";

export const Route = createFileRoute("/listings/batch")({
  head: () => ({
    meta: [
      { title: "ورود گروهی فایل‌ها | املاک صدرا" },
      {
        name: "description",
        content:
          "ورود گروهی عکس‌ها و فایل ZIP برگه‌های ملکی، پردازش مرحله‌به‌مرحله OCR و تطبیق با فایل‌های موجود.",
      },
      { property: "og:title", content: "ورود گروهی فایل‌ها" },
      {
        property: "og:description",
        content: "پردازش دسته‌ای عکس‌های ملکی با صف OCR، تطبیق با فایل موجود و گزارش نهایی.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BatchRoute,
});

const PAGE_SIZE = 20;

const SERVER_CONFIDENCE_LABELS: Record<string, string> = {
  high: "اطمینان بالا",
  medium: "اطمینان متوسط",
  low: "اطمینان کم",
};

const SERVER_CONFIDENCE_TONE: Record<string, string> = {
  high: "bg-primary/10 text-primary",
  medium: "bg-warning/10 text-warning",
  low: "bg-secondary text-muted-foreground",
};

const EMPTY_COUNTS: Record<BatchStatus, number> = {
  pending: 0,
  ocr: 0,
  review: 0,
  manual: 0,
  duplicate: 0,
  linked: 0,
  done: 0,
  error: 0,
};

function BatchRoute() {
  return <AdminOnly>{(userId) => <BatchImport userId={userId} />}</AdminOnly>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${faDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${faDigits((bytes / 1024).toFixed(0))} کیلوبایت`;
  return `${faDigits((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}

function faDate(value: number): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
    calendar: "persian",
  }).format(new Date(value));
}

function remaining(counts: Record<BatchStatus, number>): number {
  return counts.pending + counts.ocr + counts.review + counts.manual + counts.error;
}

function BatchImport({ userId }: { userId: string }) {
  const runOcr = useServerFn(extractPropertyFromImage);
  const queryClient = useQueryClient();

  const [batches, setBatches] = useState<StoredBatch[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [itemTotal, setItemTotal] = useState(0);
  const [counts, setCounts] = useState<Record<BatchStatus, number>>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [page, setPage] = useState(1);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<Awaited<ReturnType<typeof getItem>>>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  /* --- optional server queue (additive; the device queue stays the fallback) --- */
  const runWorker = useServerFn(runBulkImportWorker);
  const [serverBatchId, setServerBatchId] = useState<string | null>(null);
  const [serverStats, setServerStats] = useState<Record<ServerStatus, number> | null>(null);
  const [serverBusy, setServerBusy] = useState(false);
  const [serverMatches, setServerMatches] = useState<ServerMatchItem[] | null>(null);

  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const cancelRef = useRef(false);
  const ledgerRef = useRef<Set<string>>(new Set());
  /** Identifies this tab so two tabs never claim the same queue item. */
  const workerId = useRef(crypto.randomUUID());
  const batchIdRef = useRef<string | null>(null);
  const pageRef = useRef(1);

  useEffect(() => {
    batchIdRef.current = batchId;
  }, [batchId]);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    ledgerRef.current = loadHashLedger();
  }, []);

  const refresh = useCallback(async (id?: string | null) => {
    const target = id ?? batchIdRef.current;
    setBatches(await listBatches());
    if (!target) {
      setItems([]);
      setItemTotal(0);
      setCounts(EMPTY_COUNTS);
      return;
    }
    const [nextCounts, listed] = await Promise.all([
      countsFor(target),
      pageItems(target, pageRef.current, PAGE_SIZE),
    ]);
    setCounts(nextCounts);
    setItems(listed.rows);
    setItemTotal(listed.total);
  }, []);

  /** Restores unfinished batches after a refresh, closed browser or lost connection. */
  useEffect(() => {
    void (async () => {
      try {
        const stored = await listBatches();
        setBatches(stored);
        const resumable = stored.find((batch) => batch.status !== "done");
        if (resumable) {
          await releaseStale(resumable.id);
          setBatchId(resumable.id);
          batchIdRef.current = resumable.id;
          await refresh(resumable.id);
        }
      } catch (error) {
        console.error(error);
        toast.error("صف ذخیره‌شده خوانده نشد");
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    if (batchId) void refresh(batchId);
  }, [batchId, page, refresh]);

  /* ------------------------------ selecting ------------------------------ */

  const addFiles = useCallback(
    async (incoming: File[]) => {
      const entries: NewItem[] = [];
      const skipped: string[] = [];
      for (const file of incoming) {
        const isZip =
          file.name.toLowerCase().endsWith(".zip") ||
          file.type === "application/zip" ||
          file.type === "application/x-zip-compressed";
        if (isZip) {
          try {
            const { files, skipped: ignored } = await expandZip(file);
            skipped.push(...ignored);
            for (const entry of files) {
              entries.push({
                name: entry.name,
                folder: entry.folder,
                size: entry.file.size,
                source: "zip",
                zipName: file.name,
                blob: entry.file,
              });
            }
            if (!files.length) toast.error(`هیچ عکسی در ${file.name} پیدا نشد`);
          } catch {
            entries.push({
              name: file.name,
              folder: "",
              size: file.size,
              source: "zip",
              blob: null,
              status: "error",
              error: "فایل ZIP خراب یا غیرقابل خواندن است",
            });
          }
          continue;
        }
        if (!isImageName(file.name) && !file.type.startsWith("image/")) {
          skipped.push(file.name);
          continue;
        }
        entries.push({
          name: file.name,
          folder: "",
          size: file.size,
          source: "file",
          blob: file,
        });
      }

      if (!entries.length) {
        if (!skipped.length) toast.error("فایل قابل پردازشی انتخاب نشد");
        return;
      }

      let target = batchIdRef.current;
      if (!target) {
        const created = await createBatch(0, skipped);
        target = created.id;
        setBatchId(target);
        batchIdRef.current = target;
      } else if (skipped.length) {
        const current = batches.find((batch) => batch.id === target);
        await patchBatch(target, { skipped: [...(current?.skipped ?? []), ...skipped] });
      }
      await addItems(target, entries);
      await refresh(target);
      toast.success(`${faDigits(entries.length)} مورد به صف اضافه شد`);
    },
    [batches, refresh],
  );

  async function removeItem(id: string) {
    await deleteItem(id);
    await refresh();
  }

  /* ------------------------------ processing ----------------------------- */

  const processItem = useCallback(
    async (item: NonNullable<Awaited<ReturnType<typeof getItem>>>) => {
      const file = item.blob;
      if (!file) {
        await patchItem(item.id, { status: "error", error: "فایل تصویر در دسترس نیست" });
        return;
      }
      try {
        const hash = item.hash ?? (await hashFile(new File([file], item.name)));
        if (hash && ledgerRef.current.has(hash)) {
          await patchItem(item.id, {
            status: "duplicate",
            hash,
            blob: null,
            error: "این عکس قبلاً پردازش شده است؛ فایل تکراری ساخته نشد",
          });
          return;
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });

        const result = item.ocr ?? (await runOcr({ data: { image: dataUrl } }));
        await patchItem(item.id, { ocr: result, hash });

        if (!hasEnoughData(result)) {
          await patchItem(item.id, { status: "manual", error: null });
          return;
        }

        const candidates = await findOcrCandidates(result);
        if (candidates.length) {
          await patchItem(item.id, { status: "review", candidates, error: null });
          return;
        }

        const created = await createFromOcr({
          result,
          userId,
          image: new File([file], item.name),
        });
        if (hash) {
          ledgerRef.current.add(hash);
          saveHashLedger(ledgerRef.current);
        }
        await patchItem(item.id, {
          status: "done",
          blob: null,
          propertyId: created.id,
          fileCode: created.fileCode,
        });
      } catch (error) {
        console.error(error);
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        await patchItem(item.id, {
          status: "error",
          error: offline
            ? "اتصال اینترنت قطع شد؛ بعد از وصل شدن «تلاش دوباره» را بزنید"
            : error instanceof Error
              ? error.message
              : "پردازش این عکس ناموفق بود",
        });
      }
    },
    [runOcr, userId],
  );

  const runQueue = useCallback(async () => {
    const target = batchIdRef.current;
    if (!target || runningRef.current) return;
    runningRef.current = true;
    cancelRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    setRunning(true);
    await patchBatch(target, { status: "active" });
    try {
      // One image at a time: the AI gateway is never flooded, a single failure
      // never stops the batch, and only one claimed item is in memory.
      for (;;) {
        if (cancelRef.current || pausedRef.current) break;
        const next = await claimNext(target, workerId.current);
        if (!next) break;
        await processItem(next);
        await patchBatch(target, { last_processed_at: Date.now() });
        await refresh(target);
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
      const left = remaining(await countsFor(target));
      await patchBatch(target, {
        status: left ? (pausedRef.current || cancelRef.current ? "paused" : "active") : "done",
      });
      await refresh(target);
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
    }
  }, [processItem, queryClient, refresh]);

  function pause() {
    pausedRef.current = true;
    setPaused(true);
  }

  function cancel() {
    cancelRef.current = true;
    pausedRef.current = true;
    setPaused(false);
    toast.info("پردازش متوقف شد؛ موارد باقی‌مانده در صف می‌مانند");
  }

  async function retryErrors() {
    const target = batchIdRef.current;
    if (!target) return;
    const queued = await resetErrors(target);
    await refresh(target);
    if (!queued) {
      toast.error(`این موارد بیش از ${faDigits(MAX_RETRIES)} بار تلاش شده‌اند`);
      return;
    }
    void runQueue();
  }

  async function resumeBatch(id: string) {
    await releaseStale(id);
    setBatchId(id);
    batchIdRef.current = id;
    setPage(1);
    pageRef.current = 1;
    await refresh(id);
    void runQueue();
  }

  async function removeBatch(id: string) {
    await deleteBatch(id);
    if (batchIdRef.current === id) {
      setBatchId(null);
      batchIdRef.current = null;
    }
    await refresh(null);
    toast.success("دسته حذف شد");
  }

  /* ----------------------------- server queue ---------------------------- */

  /** Mirrors a bounded slice of the device queue into the database queue. */
  async function sendToServerQueue() {
    const target = batchIdRef.current;
    if (!target) return;
    setServerBusy(true);
    try {
      const rows = await pendingItems(target, 25);
      if (!rows.length) {
        toast.info("موردی برای ارسال به صف سرور نیست");
        return;
      }
      const id = serverBatchId ?? (await createServerBatch(userId, []));
      setServerBatchId(id);
      const count = await pushServerItems(
        id,
        userId,
        rows.map((row) => ({
          name: row.name,
          folder: row.folder,
          size: row.size,
          source: row.source,
          hash: row.hash ?? null,
          file: new File([row.blob as Blob], row.name),
        })),
      );
      setServerStats(await serverCounts(id));
      setServerMatches(null);
      toast.success(`${faDigits(count)} مورد به صف سرور اضافه شد`);
    } catch (error) {
      console.error(error);
      toast.error("ارسال به صف سرور ناموفق بود؛ پردازش روی همین دستگاه فعال است");
    } finally {
      setServerBusy(false);
    }
  }

  async function runServerWorker() {
    if (!serverBatchId) return;
    setServerBusy(true);
    try {
      const report = await runWorker({ data: { batchId: serverBatchId, limit: 3 } });
      setServerStats(await serverCounts(serverBatchId));
      setServerMatches(await serverMatchingResults(serverBatchId));
      toast.success(
        report.idle
          ? "موردی برای پردازش سروری باقی نمانده است"
          : `${faDigits(report.processed)} مورد روی سرور پردازش شد`,
      );
    } catch (error) {
      console.error(error);
      toast.error("پردازش سروری ناموفق بود؛ می‌توانید از پردازش همین دستگاه استفاده کنید");
    } finally {
      setServerBusy(false);
    }
  }

  async function refreshServerStats() {
    if (!serverBatchId) return;
    try {
      setServerStats(await serverCounts(serverBatchId));
      setServerMatches(await serverMatchingResults(serverBatchId));
    } catch (error) {
      console.error(error);
      toast.error("وضعیت صف سرور خوانده نشد");
    }
  }

  /** Records the choice only — no property, price history, photo or file code. */
  async function chooseServerDecision(
    itemId: string,
    decision: ServerDecision,
    propertyId?: string | null,
  ) {
    try {
      await saveServerDecision(itemId, decision, propertyId ?? null);
      setServerMatches((current) =>
        (current ?? []).map((match) =>
          match.id === itemId
            ? {
                ...match,
                decision,
                decision_property_id: decision === "connect_existing" ? (propertyId ?? null) : null,
              }
            : match,
        ),
      );
      toast.success("تصمیم ذخیره شد؛ اجرای آن در مرحله بعد انجام می‌شود");
    } catch (error) {
      console.error(error);
      toast.error("ذخیره تصمیم ناموفق بود");
    }
  }

  /* -------------------------------- review ------------------------------- */

  useEffect(() => {
    if (!reviewId) {
      setReviewData(null);
      return;
    }
    void getItem(reviewId).then(setReviewData);
  }, [reviewId]);

  async function createNewFrom(id: string) {
    const row = await getItem(id);
    if (!row?.ocr) return;
    setBusyId(id);
    try {
      const created = await createFromOcr({
        result: row.ocr,
        userId,
        image: row.blob ? new File([row.blob], row.name) : null,
      });
      if (row.hash) {
        ledgerRef.current.add(row.hash);
        saveHashLedger(ledgerRef.current);
      }
      await patchItem(id, {
        status: "done",
        blob: null,
        propertyId: created.id,
        fileCode: created.fileCode,
      });
      setReviewId(null);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("فایل جدید ثبت شد");
    } catch (error) {
      console.error(error);
      toast.error("ثبت فایل جدید ناموفق بود");
    } finally {
      setBusyId(null);
    }
  }

  async function linked(id: string, propertyId: string) {
    const row = await getItem(id);
    if (row?.blob) {
      try {
        await attachPrivateImage(propertyId, userId, new File([row.blob], row.name));
      } catch (error) {
        console.error(error);
      }
    }
    if (row?.hash) {
      ledgerRef.current.add(row.hash);
      saveHashLedger(ledgerRef.current);
    }
    await patchItem(id, { status: "linked", blob: null, propertyId });
    setReviewId(null);
    await refresh();
    await queryClient.invalidateQueries({ queryKey: ["properties"] });
  }

  /* -------------------------------- summary ------------------------------ */

  const stats = useMemo(() => {
    const total = itemTotal;
    const processed = total - counts.pending - counts.ocr;
    return {
      total,
      processed,
      done: counts.done,
      linked: counts.linked,
      review: counts.review + counts.manual,
      duplicate: counts.duplicate,
      error: counts.error,
      pending: counts.pending,
      size: items.reduce((sum, item) => sum + item.size, 0),
    };
  }, [counts, itemTotal, items]);

  const percent = stats.total ? Math.round((stats.processed / stats.total) * 100) : 0;
  const pageCount = Math.max(1, Math.ceil(itemTotal / PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const otherBatches = batches.filter((batch) => batch.id !== batchId && batch.status !== "done");

  return (
    <AppShell
      title="ورود گروهی فایل‌ها"
      subtitle="پردازش دسته‌ای عکس‌ها و فایل ZIP با OCR"
    >
      <div className="space-y-4">
        {/* unfinished batches */}
        {otherBatches.length ? (
          <section className="surface-card space-y-2 p-4">
            <p className="text-sm font-semibold">دسته‌های نیمه‌تمام</p>
            <p className="text-xs text-muted-foreground">
              این دسته‌ها روی همین دستگاه ذخیره شده‌اند و از همان جایی که مانده‌اند ادامه پیدا
              می‌کنند.
            </p>
            <ul className="space-y-2">
              {otherBatches.map((batch) => (
                <li
                  key={batch.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">
                      {faDigits(batch.total)} فایل · {faDate(batch.created_at)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      آخرین پردازش:{" "}
                      {batch.last_processed_at ? faDate(batch.last_processed_at) : "شروع نشده"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-10"
                      onClick={() => void resumeBatch(batch.id)}
                    >
                      <Play className="size-4" />
                      ادامه پردازش
                    </Button>
                    <button
                      type="button"
                      onClick={() => void removeBatch(batch.id)}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-destructive"
                    >
                      <Trash2 className="size-4" />
                      حذف
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* selection */}
        <section
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void addFiles(Array.from(event.dataTransfer.files));
          }}
          className={`surface-card space-y-3 p-4 ${dragging ? "border-primary" : ""}`}
        >
          <p className="text-sm font-semibold">۱. انتخاب عکس‌ها یا فایل ZIP</p>
          <p className="text-xs text-muted-foreground">
            می‌توانید چند عکس را همزمان انتخاب کنید، فایل ZIP بدهید یا در رایانه فایل‌ها را
            روی همین کادر رها کنید. صف روی همین دستگاه ذخیره می‌شود؛ اگر صفحه بسته شود یا
            اینترنت قطع شود، از بین نمی‌رود.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm font-semibold">
              <Images className="size-4" />
              انتخاب عکس‌ها
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  void addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm font-semibold">
              <FileArchive className="size-4" />
              انتخاب فایل ZIP
              <input
                type="file"
                accept=".zip,application/zip"
                multiple
                className="hidden"
                onChange={(event) => {
                  void addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>تعداد در صف: {faDigits(stats.total)}</span>
            <span>·</span>
            <span>حجم این صفحه: {formatSize(stats.size)}</span>
          </div>
          {batches.find((batch) => batch.id === batchId)?.skipped.length ? (
            <p className="text-xs text-warning">
              {faDigits(batches.find((batch) => batch.id === batchId)?.skipped.length ?? 0)} فایل
              غیرتصویری نادیده گرفته شد
            </p>
          ) : null}
        </section>

        {/* controls */}
        <section className="surface-card space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">۲. پردازش</p>
            <p className="text-xs text-muted-foreground">
              {faDigits(stats.processed)} از {faDigits(stats.total)} فایل پردازش شد
              {stats.total ? ` (${faDigits(percent)}٪)` : ""}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              className="min-h-11"
              disabled={running || !stats.pending}
              onClick={() => void runQueue()}
            >
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {paused ? "ادامه پردازش" : "شروع پردازش"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={!running}
              onClick={pause}
            >
              <Pause className="size-4" />
              مکث
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={!running}
              onClick={cancel}
            >
              <Square className="size-4" />
              لغو پردازش
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={!stats.error || running}
              onClick={() => void retryErrors()}
            >
              <RefreshCw className="size-4" />
              تلاش دوباره برای خطاها
            </Button>
          </div>
        </section>

        {/* server queue (optional) */}
        <section className="surface-card space-y-3 p-4">
          <p className="text-sm font-semibold">پردازش روی سرور (آزمایشی)</p>
          <p className="text-xs text-muted-foreground">
            می‌توانید بخشی از صف را به سرور بسپارید تا حتی با بسته شدن این صفحه پردازش ادامه
            پیدا کند. پردازش روی همین دستگاه بدون تغییر باقی می‌ماند.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={serverBusy || !stats.pending}
              onClick={() => void sendToServerQueue()}
            >
              {serverBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              ارسال به صف سرور
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={serverBusy || !serverBatchId}
              onClick={() => void runServerWorker()}
            >
              <Play className="size-4" />
              پردازش سروری
            </Button>
          </div>
          {serverStats ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {SERVER_STATUSES.filter((status) => serverStats[status] > 0).map((status) => (
                  <Stat key={status} label={SERVER_STATUS_LABELS[status]} value={serverStats[status]} />
                ))}
              </div>
              <button
                type="button"
                onClick={() => void refreshServerStats()}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold"
              >
                <RefreshCw className="size-4" />
                بروزرسانی وضعیت سرور
              </button>
            </>
          ) : null}
          {serverMatches?.length ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold">نتیجه تطبیق سرور</p>
              <ul className="space-y-2">
                {serverMatches.map((match) => (
                  <li
                    key={match.id}
                    className="space-y-2 rounded-xl border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-semibold">{match.name}</p>
                      {match.top_confidence ? (
                        <span
                          className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                            SERVER_CONFIDENCE_TONE[match.top_confidence] ??
                            "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {SERVER_CONFIDENCE_LABELS[match.top_confidence] ??
                            match.top_confidence}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {faDigits(match.candidates.length)} کاندید پیدا شد
                    </p>
                    {match.candidates.length ? (
                      <ul className="space-y-1">
                        {match.candidates.map((candidate, index) => (
                          <li
                            key={candidate.property_id ?? index}
                            className="space-y-1 rounded-lg bg-secondary/50 p-2 text-[11px]"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="font-semibold">{candidate.title}</span>
                              <span className="text-muted-foreground">
                                {candidate.file_code
                                  ? `کد ${faDigits(candidate.file_code)} · `
                                  : ""}
                                {SERVER_CONFIDENCE_LABELS[candidate.confidence] ??
                                  candidate.confidence}
                              </span>
                            </div>
                            {candidate.reasons?.length ? (
                              <p className="text-muted-foreground">
                                {candidate.reasons.join(" · ")}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        کاندیدایی پیدا نشد؛ برای ثبت دستی به فهرست فایل‌ها مراجعه کنید
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : serverStats && serverStats.needs_review > 0 && serverMatches !== null ? (
            <p className="text-[11px] text-muted-foreground">
              نتیجه تطبیقی برای نمایش نیست.
            </p>
          ) : null}
        </section>


        {/* report */}
        {stats.total ? (
          <section className="surface-card space-y-2 p-4">
            <p className="text-sm font-semibold">۳. گزارش</p>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <Stat label="کل فایل‌ها" value={stats.total} />
              <Stat label="فایل جدید" value={stats.done} />
              <Stat label="متصل به فایل موجود" value={stats.linked} />
              <Stat label="نیازمند بررسی" value={stats.review} />
              <Stat label="تکراری" value={stats.duplicate} />
              <Stat label="خطا" value={stats.error} />
            </div>
          </section>
        ) : null}

        {/* queue */}
        <section className="space-y-2">
          <p className="text-sm font-semibold">صف پردازش</p>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : items.length ? (
            <>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="surface-card space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.zipName ? `از ${item.zipName}` : "عکس انتخاب‌شده"}
                          {item.folder ? ` · پوشه ${item.folder}` : ""} ·{" "}
                          {formatSize(item.size)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold ${BATCH_STATUS_TONE[item.status]}`}
                      >
                        {BATCH_STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    {item.error ? (
                      <p className="text-[11px] text-destructive">{item.error}</p>
                    ) : null}
                    {item.candidateCount ? (
                      <p className="text-[11px] text-muted-foreground">
                        {faDigits(item.candidateCount)} فایل مشابه پیدا شد
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {item.status === "review" ? (
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-10"
                          onClick={() => setReviewId(item.id)}
                        >
                          بررسی و تطبیق
                        </Button>
                      ) : null}
                      {item.status === "manual" ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-10"
                            disabled={busyId === item.id}
                            onClick={() => void createNewFrom(item.id)}
                          >
                            {busyId === item.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Upload className="size-4" />
                            )}
                            ثبت همین اطلاعات
                          </Button>
                          <Link
                            to="/listings/new"
                            search={{ broker: undefined }}
                            className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-xs font-semibold"
                          >
                            ثبت دستی
                          </Link>
                        </>
                      ) : null}
                      {item.propertyId ? (
                        <Link
                          to="/listings/$id"
                          params={{ id: item.propertyId }}
                          className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-xs font-semibold"
                        >
                          مشاهده فایل {fileCodeText(item.fileCode)}
                        </Link>
                      ) : null}
                      {item.status === "pending" || item.status === "error" ? (
                        <button
                          type="button"
                          onClick={() => void removeItem(item.id)}
                          className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-destructive"
                        >
                          <Trash2 className="size-4" />
                          حذف از صف
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              {pageCount > 1 ? (
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    قبلی
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    صفحه {faDigits(page)} از {faDigits(pageCount)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10"
                    disabled={page >= pageCount}
                    onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                  >
                    بعدی
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="surface-card p-4 text-xs text-muted-foreground">
              هنوز فایلی انتخاب نشده است.
            </p>
          )}
        </section>
      </div>

      <OcrMatchDialog
        open={Boolean(reviewData)}
        result={(reviewData?.ocr as OcrResult | null) ?? null}
        candidates={reviewData?.candidates ?? []}
        userId={userId}
        onOpenChange={(open) => {
          if (!open) setReviewId(null);
        }}
        onLinked={(propertyId) => {
          if (reviewId) void linked(reviewId, propertyId);
        }}
        onCreateNew={() => {
          if (reviewId) void createNewFrom(reviewId);
        }}
      />
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{faDigits(value)}</p>
    </div>
  );
}
