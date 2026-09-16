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
} from "@/lib/batch-import";
import { extractPropertyFromImage, type OcrResult } from "@/lib/ocr.functions";
import { findOcrCandidates, type OcrCandidate } from "@/lib/ocr-match";
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

function BatchRoute() {
  return <AdminOnly>{(userId) => <BatchImport userId={userId} />}</AdminOnly>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${faDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${faDigits((bytes / 1024).toFixed(0))} کیلوبایت`;
  return `${faDigits((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}

function BatchImport({ userId }: { userId: string }) {
  const runOcr = useServerFn(extractPropertyFromImage);
  const queryClient = useQueryClient();

  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [page, setPage] = useState(1);
  const [skippedZipEntries, setSkippedZipEntries] = useState<string[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Heavy data lives outside React state so the UI stays light for huge batches. */
  const filesRef = useRef(new Map<string, File>());
  const resultsRef = useRef(new Map<string, OcrResult>());
  const candidatesRef = useRef(new Map<string, OcrCandidate[]>());
  const itemsRef = useRef<BatchItem[]>([]);
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const cancelRef = useRef(false);
  const ledgerRef = useRef<Set<string>>(new Set());
  const batchHashesRef = useRef(new Set<string>());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    ledgerRef.current = loadHashLedger();
  }, []);

  const patch = useCallback((id: string, next: Partial<BatchItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }, []);

  /* ------------------------------ selecting ------------------------------ */

  const addFiles = useCallback(async (incoming: File[]) => {
    const added: BatchItem[] = [];
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
            const id = crypto.randomUUID();
            filesRef.current.set(id, entry.file);
            added.push({
              id,
              name: entry.name,
              folder: entry.folder,
              size: entry.file.size,
              source: "zip",
              zipName: file.name,
              status: "pending",
            });
          }
          if (!files.length) toast.error(`هیچ عکسی در ${file.name} پیدا نشد`);
        } catch {
          const id = crypto.randomUUID();
          added.push({
            id,
            name: file.name,
            folder: "",
            size: file.size,
            source: "zip",
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
      const id = crypto.randomUUID();
      filesRef.current.set(id, file);
      added.push({
        id,
        name: file.name,
        folder: "",
        size: file.size,
        source: "file",
        status: "pending",
      });
    }

    if (skipped.length) setSkippedZipEntries((prev) => [...prev, ...skipped]);
    if (added.length) {
      setItems((prev) => [...prev, ...added]);
      toast.success(`${faDigits(added.length)} مورد به صف اضافه شد`);
    } else if (!skipped.length) {
      toast.error("فایل قابل پردازشی انتخاب نشد");
    }
  }, []);

  function removeItem(id: string) {
    filesRef.current.delete(id);
    resultsRef.current.delete(id);
    candidatesRef.current.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  /* ------------------------------ processing ----------------------------- */

  const processItem = useCallback(
    async (item: BatchItem) => {
      patch(item.id, { status: "ocr", error: null });
      const file = filesRef.current.get(item.id);
      if (!file) {
        patch(item.id, { status: "error", error: "فایل تصویر در دسترس نیست" });
        return;
      }
      try {
        const hash = await hashFile(file);
        if (hash && (ledgerRef.current.has(hash) || batchHashesRef.current.has(hash))) {
          patch(item.id, {
            status: "duplicate",
            hash,
            error: "این عکس قبلاً پردازش شده است؛ فایل تکراری ساخته نشد",
          });
          return;
        }
        if (hash) batchHashesRef.current.add(hash);

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });

        const result = await runOcr({ data: { image: dataUrl } });
        resultsRef.current.set(item.id, result);

        if (!hasEnoughData(result)) {
          patch(item.id, { status: "manual", hash, error: null });
          return;
        }

        const candidates = await findOcrCandidates(result);
        if (candidates.length) {
          candidatesRef.current.set(item.id, candidates);
          patch(item.id, { status: "review", hash, candidateCount: candidates.length });
          return;
        }

        const created = await createFromOcr({ result, userId, image: file });
        if (hash) {
          ledgerRef.current.add(hash);
          saveHashLedger(ledgerRef.current);
        }
        filesRef.current.delete(item.id);
        patch(item.id, {
          status: "done",
          hash,
          propertyId: created.id,
          fileCode: created.fileCode,
        });
      } catch (error) {
        console.error(error);
        patch(item.id, {
          status: "error",
          error: error instanceof Error ? error.message : "پردازش این عکس ناموفق بود",
        });
      }
    },
    [patch, runOcr, userId],
  );

  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    setRunning(true);
    try {
      // One image at a time: a single failure never stops the whole batch and
      // the AI gateway is not flooded with parallel requests.
      for (;;) {
        if (cancelRef.current || pausedRef.current) break;
        const next = itemsRef.current.find((item) => item.status === "pending");
        if (!next) break;
        await processItem(next);
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
    }
  }, [processItem, queryClient]);

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

  function retryErrors() {
    setItems((prev) =>
      prev.map((item) =>
        item.status === "error" ? { ...item, status: "pending", error: null } : item,
      ),
    );
    setTimeout(() => void runQueue(), 0);
  }

  /* -------------------------------- review ------------------------------- */

  async function createNewFrom(id: string) {
    const result = resultsRef.current.get(id);
    const file = filesRef.current.get(id);
    if (!result) return;
    setBusyId(id);
    try {
      const created = await createFromOcr({ result, userId, image: file ?? null });
      patch(id, { status: "done", propertyId: created.id, fileCode: created.fileCode });
      const item = itemsRef.current.find((row) => row.id === id);
      if (item?.hash) {
        ledgerRef.current.add(item.hash);
        saveHashLedger(ledgerRef.current);
      }
      filesRef.current.delete(id);
      setReviewId(null);
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
    const file = filesRef.current.get(id);
    if (file) {
      try {
        await attachPrivateImage(propertyId, userId, file);
      } catch (error) {
        console.error(error);
      }
    }
    const item = itemsRef.current.find((row) => row.id === id);
    if (item?.hash) {
      ledgerRef.current.add(item.hash);
      saveHashLedger(ledgerRef.current);
    }
    filesRef.current.delete(id);
    patch(id, { status: "linked", propertyId });
    setReviewId(null);
    await queryClient.invalidateQueries({ queryKey: ["properties"] });
  }

  /* -------------------------------- summary ------------------------------ */

  const stats = useMemo(() => {
    const count = (status: BatchItem["status"]) =>
      items.filter((item) => item.status === status).length;
    const processed = items.filter(
      (item) => !["pending", "ocr"].includes(item.status),
    ).length;
    return {
      total: items.length,
      processed,
      done: count("done"),
      linked: count("linked"),
      review: count("review") + count("manual"),
      duplicate: count("duplicate"),
      error: count("error"),
      pending: count("pending"),
      size: items.reduce((sum, item) => sum + item.size, 0),
    };
  }, [items]);

  const percent = stats.total ? Math.round((stats.processed / stats.total) * 100) : 0;
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visible = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const reviewItem = reviewId ? items.find((item) => item.id === reviewId) : null;

  return (
    <AppShell
      title="ورود گروهی فایل‌ها"
      subtitle="پردازش دسته‌ای عکس‌ها و فایل ZIP با OCR"
    >
      <div className="space-y-4">
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
            روی همین کادر رها کنید.
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
            <span>حجم کل: {formatSize(stats.size)}</span>
          </div>
          {skippedZipEntries.length ? (
            <p className="text-xs text-warning">
              {faDigits(skippedZipEntries.length)} فایل غیرتصویری نادیده گرفته شد:{" "}
              {skippedZipEntries.slice(0, 3).join("، ")}
              {skippedZipEntries.length > 3 ? " …" : ""}
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
              onClick={retryErrors}
            >
              <RefreshCw className="size-4" />
              تلاش دوباره برای خطاها
            </Button>
          </div>
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
          {items.length ? (
            <>
              <ul className="space-y-2">
                {visible.map((item) => (
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
                          onClick={() => removeItem(item.id)}
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
        open={Boolean(reviewItem)}
        result={reviewId ? (resultsRef.current.get(reviewId) ?? null) : null}
        candidates={reviewId ? (candidatesRef.current.get(reviewId) ?? []) : []}
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
