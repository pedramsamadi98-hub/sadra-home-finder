import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, FilePlus2, Link2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { faArea, faDate, faDigits, faPrice } from "@/lib/fa";
import type { OcrResult } from "@/lib/ocr.functions";
import {
  CONFIDENCE_LABELS,
  jalaliToISO,
  linkOcrToProperty,
  planChanges,
  priceEventsOf,
  type FieldChange,
  type MatchConfidence,
  type OcrCandidate,
} from "@/lib/ocr-match";
import {
  fileCodeText,
  isArchived,
  neighborhoodLabel,
  propertyTypeLabel,
  STATUS_LABELS,
} from "@/lib/properties";

const CONFIDENCE_TONE: Record<MatchConfidence, string> = {
  high: "bg-success/15 text-success",
  medium: "bg-primary/15 text-primary",
  low: "bg-muted text-muted-foreground",
};

/**
 * Shown before a new file is created when the reading may belong to an existing
 * file. Nothing is merged automatically: the user links, creates a new file, or
 * cancels. Conflicting values are only replaced when explicitly ticked.
 */
export function OcrMatchDialog({
  open,
  result,
  candidates,
  userId,
  onOpenChange,
  onLinked,
  onCreateNew,
}: {
  open: boolean;
  result: OcrResult | null;
  candidates: OcrCandidate[];
  userId: string;
  onOpenChange: (open: boolean) => void;
  onLinked: (propertyId: string) => void;
  onCreateNew: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [verifyPrice, setVerifyPrice] = useState(false);
  const [restore, setRestore] = useState(false);

  const selected = candidates.find((item) => item.property.id === selectedId) ?? candidates[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const first = candidates[0]?.property.id ?? null;
    setSelectedId(first);
    setVerifyPrice(false);
    setRestore(false);
  }, [open, candidates]);

  const changes: FieldChange[] = useMemo(
    () => (selected && result ? planChanges(selected.property, result) : []),
    [selected, result],
  );

  useEffect(() => {
    // Empty fields are filled by default; a differing existing value is not.
    setAccepted(
      Object.fromEntries(changes.map((change) => [String(change.key), !change.conflict])),
    );
  }, [changes]);

  const priceEvents = result ? priceEventsOf(result) : [];

  const link = useMutation({
    mutationFn: async () => {
      if (!selected || !result) throw new Error("no candidate");
      return linkOcrToProperty({
        property: selected.property,
        result,
        accepted: changes.filter((change) => accepted[String(change.key)]),
        userId,
        verifyPrice,
        restore,
      });
    },
    onSuccess: (summary) => {
      toast.success(
        `اطلاعات به فایل ${faDigits(fileCodeText(selected?.property.file_code ?? null))} اضافه شد` +
          (summary.events ? ` — ${faDigits(summary.events)} رکورد قیمت` : ""),
      );
      onOpenChange(false);
      if (selected) onLinked(selected.property.id);
    },
    onError: () => toast.error("اتصال به فایل موجود ناموفق بود"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto rounded-2xl text-right"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="text-base">احتمالاً این عکس مربوط به فایل موجود است</DialogTitle>
          <DialogDescription className="text-xs leading-6">
            پیش از ثبت فایل جدید، فایل‌های مشابه بررسی شد. اگر مربوط به یکی از این فایل‌هاست،
            اطلاعات جدید به همان فایل اضافه می‌شود و کد فایل تغییر نمی‌کند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {candidates.map((candidate) => {
            const property = candidate.property;
            const active = selected?.property.id === property.id;
            return (
              <button
                key={property.id}
                type="button"
                onClick={() => setSelectedId(property.id)}
                className={`w-full rounded-xl border p-3 text-start transition-colors ${
                  active ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">{property.title}</p>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_TONE[candidate.confidence]}`}
                  >
                    {CONFIDENCE_LABELS[candidate.confidence]}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  کد فایل {faDigits(fileCodeText(property.file_code))} ·{" "}
                  {propertyTypeLabel(property.property_type)} · {faArea(property.area)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {[property.phase, neighborhoodLabel(property.neighborhood), property.street]
                    .filter(Boolean)
                    .join(" · ") || "بدون آدرس"}
                </p>
                {isArchived(property) ? (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
                    <AlertTriangle className="size-3" />
                    {STATUS_LABELS[property.status]}
                  </p>
                ) : null}
                {candidate.reasons.length ? (
                  <p className="mt-1 text-[11px] text-primary">
                    {candidate.reasons.join(" · ")}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>

        {selected ? (
          <div className="space-y-3">
            <p className="text-xs font-bold">اطلاعات جدید خوانده‌شده</p>
            {changes.length ? (
              <div className="space-y-2">
                {changes.map((change) => (
                  <label
                    key={String(change.key)}
                    className="flex items-start gap-2 rounded-xl border border-border p-3"
                  >
                    <Checkbox
                      checked={Boolean(accepted[String(change.key)])}
                      onCheckedChange={(value) =>
                        setAccepted((prev) => ({ ...prev, [String(change.key)]: value === true }))
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1 text-xs leading-6">
                      <span className="font-bold">{change.label}</span>
                      <span className="block text-muted-foreground">
                        {change.conflict
                          ? `مقدار فعلی: ${faDigits(change.current)} → مقدار جدید: ${faDigits(change.next)}`
                          : `مقدار جدید: ${faDigits(change.next)}`}
                      </span>
                      {change.conflict ? (
                        <span className="block text-[11px] text-destructive">
                          مقدار قبلی با مقدار جدید تفاوت دارد — فقط با تأیید شما جایگزین می‌شود.
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
                فیلد جدیدی برای تکمیل این فایل خوانده نشد.
              </p>
            )}

            {priceEvents.length ? (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <p className="text-xs font-bold">قیمت‌های خوانده‌شده (به تاریخچه اضافه می‌شوند)</p>
                {priceEvents.map((event, index) => (
                  <p key={index} className="text-[11px] text-muted-foreground">
                    {event.date ? faDate(jalaliToISO(event.date)) || faDigits(event.date) : "بدون تاریخ"}
                    {" — "}
                    {faPrice(event.price ?? null)}
                  </p>
                ))}
                <label className="mt-1 flex items-start gap-2 text-[11px] leading-6">
                  <Checkbox
                    checked={verifyPrice}
                    onCheckedChange={(value) => setVerifyPrice(value === true)}
                    className="mt-0.5"
                  />
                  <span>
                    جدیدترین قیمت را به‌عنوان «قیمت فعلی تأییدشده» ثبت کن. بدون تأیید، قیمت‌ها فقط
                    در تاریخچه ثبت می‌شوند و قیمت فعلی حدس زده نمی‌شود.
                  </span>
                </label>
              </div>
            ) : null}

            {isArchived(selected.property) ? (
              <label className="flex items-start gap-2 rounded-xl border border-destructive/40 p-3 text-[11px] leading-6">
                <Checkbox
                  checked={restore}
                  onCheckedChange={(value) => setRestore(value === true)}
                  className="mt-0.5"
                />
                <span>این فایل بایگانی است — با تأیید شما به فهرست فعال برگردانده می‌شود.</span>
              </label>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            onClick={() => link.mutate()}
            disabled={!selected || link.isPending}
            className="h-11 w-full"
          >
            {link.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            اتصال به این فایل
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              onCreateNew();
            }}
            className="h-11 w-full"
          >
            <FilePlus2 className="size-4" />
            ثبت به‌عنوان فایل جدید
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full"
          >
            لغو
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
