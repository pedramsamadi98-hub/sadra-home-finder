import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, History, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MoneyInput } from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { faDate, faDateTime, faPrice } from "@/lib/fa";
import {
  addManualPriceEvent,
  deletePriceEvent,
  fetchPriceEvents,
  SELLER_STATUS_LABELS,
  type ManualEventInput,
  type Property,
  type SellerStatus,
} from "@/lib/properties";

type StatusChoice = "none" | SellerStatus;

/**
 * Price lifecycle of one file: the initial price it was registered with, the
 * latest price confirmed with the owner, and the full history in between.
 * Every amount uses the project's standard money input.
 */
export function PriceHistorySection({
  property,
  userId: _userId,
  canEdit,
}: {
  property: Property;
  userId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [price, setPrice] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [sellerStatus, setSellerStatus] = useState<StatusChoice>("none");

  const { data: events, isLoading } = useQuery({
    queryKey: ["price_events", property.id],
    queryFn: () => fetchPriceEvents(property.id),
  });

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["price_events", property.id] }),
      queryClient.invalidateQueries({ queryKey: ["property", property.id] }),
      queryClient.invalidateQueries({ queryKey: ["properties"] }),
    ]);
  }

  const trimmedNote = note.trim();
  const negative = price !== null && price < 0;
  const status = sellerStatus === "none" ? null : sellerStatus;
  /** Builds exactly one allowed event, or null when nothing meaningful is entered. */
  function buildEvent(): ManualEventInput | null {
    const eventAt = date ? new Date(`${date}T12:00`).toISOString() : null;
    if (price !== null) {
      return { kind: "price", price, seller_status: status, event_at: eventAt, note: trimmedNote || null };
    }
    if (status) return { kind: "update", seller_status: status, event_at: eventAt, note: trimmedNote || null };
    if (trimmedNote) return { kind: "note", note: trimmedNote, event_at: eventAt };
    return null;
  }
  const canSave = !negative && buildEvent() !== null;

  const save = useMutation({
    mutationFn: async () => {
      if (negative) throw new Error("negative");
      const input = buildEvent();
      if (!input) throw new Error("empty");
      await addManualPriceEvent(property.id, input);
    },
    onSuccess: async () => {
      await invalidate();
      setPrice(null);
      setDate("");
      setNote("");
      setSellerStatus("none");
      toast.success("ثبت شد و به تاریخچه اضافه شد");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error && error.message === "negative"
          ? "مبلغ نمی‌تواند منفی باشد"
          : "ثبت ناموفق بود",
      ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePriceEvent(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("رکورد تاریخچه حذف شد");
    },
    onError: () => toast.error("حذف ناموفق بود"),
  });

  return (
    <section className="surface-card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <History className="size-4" />
        </div>
        <h2 className="text-sm font-bold">قیمت و تاریخچه</h2>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
          <CalendarClock className="size-4 text-primary" />
          <span className="text-xs text-muted-foreground">تاریخ اولیه فایل</span>
          <span className="ms-auto text-sm font-medium">
            {faDate(property.initial_date ?? property.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
          <span className="text-xs text-muted-foreground">قیمت اولیه</span>
          <span className="ms-auto text-sm font-medium">
            {faPrice(property.initial_price)}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
          <span className="text-xs text-muted-foreground">قیمت تأییدشده فعلی</span>
          <span className="ms-auto text-sm font-medium">
            {property.verified_price === null
              ? "نیازمند استعلام"
              : faPrice(property.verified_price)}
          </span>
        </div>
        {property.price_verified_at ? (
          <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
            <span className="text-xs text-muted-foreground">آخرین تأیید قیمت</span>
            <span className="ms-auto text-end text-sm font-medium">
              {faDateTime(property.price_verified_at)}
            </span>
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <div className="space-y-3 rounded-xl bg-secondary/40 p-3">
          <p className="text-xs font-semibold">ثبت قیمت جدید</p>
          <MoneyInput
            id={`price-event-${property.id}`}
            label="قیمت تأییدشده (تومان)"
            value={price}
            onChange={setPrice}
            placeholder="مثلاً 20000000000"
          />
          <div className="space-y-1.5">
            <Label htmlFor={`price-date-${property.id}`} className="text-xs">
              تاریخ اعلام قیمت (اختیاری)
            </Label>
            <Input
              id={`price-date-${property.id}`}
              type="date"
              dir="ltr"
              className="h-11 text-left"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`price-note-${property.id}`} className="text-xs">
              یادداشت (اختیاری)
            </Label>
            <Textarea
              id={`price-note-${property.id}`}
              rows={2}
              placeholder="مثلاً: مالک ۲۰ میلیارد اعلام کرد"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <Button
            type="button"
            className="h-11 w-full"
            disabled={price === null || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            ثبت قیمت و افزودن به تاریخچه
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : (events ?? []).length ? (
        <ul className="space-y-2">
          {(events ?? []).map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-2 rounded-xl bg-secondary/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-primary">{faPrice(event.price)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {faDateTime(event.event_at)}
                  {event.source === "ocr" ? " · از روی عکس" : ""}
                </p>
                {event.note ? (
                  <p className="mt-1 break-words text-[11px] leading-5 text-muted-foreground">
                    {event.note}
                  </p>
                ) : null}
              </div>
              {canEdit ? (
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      aria-label="حذف رکورد تاریخچه"
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  }
                  title="حذف رکورد تاریخچه"
                  name={faPrice(event.price)}
                  description="این رکورد از تاریخچه قیمت حذف می‌شود."
                  confirmLabel="حذف رکورد"
                  pending={remove.isPending}
                  onConfirm={() => remove.mutate(event.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-secondary/40 p-3 text-center text-[11px] text-muted-foreground">
          تاریخچه قیمتی ثبت نشده است.
        </p>
      )}
    </section>
  );
}
