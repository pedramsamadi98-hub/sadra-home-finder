import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { touchBroker } from "@/lib/brokers";

export function PriceUpdateDialog({
  brokerId,
  brokerName,
  trigger,
}: {
  brokerId: string;
  brokerName: string;
  trigger?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const update = useMutation({
    mutationFn: () => touchBroker(brokerId, note.trim() || null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["brokers"] });
      toast.success("بروزرسانی دلال ثبت شد");
      setNote("");
      setOpen(false);
    },
    onError: () => toast.error("ثبت بروزرسانی ناموفق بود"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 px-2.5 text-[11px] font-semibold text-primary"
          >
            <Check className="size-3.5" />
            ثبت بروزرسانی
          </button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[calc(100dvh-2rem)] rounded-2xl">
        <DialogHeader className="text-start">
          <DialogTitle className="text-base">ثبت بروزرسانی قیمت</DialogTitle>
          <DialogDescription className="text-xs leading-6">
            تاریخ آخرین تماس/بروزرسانی این دلال به امروز ثبت می‌شود.
            <span className="mt-1 block font-bold text-foreground">{brokerName}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor={`price-note-${brokerId}`} className="text-xs font-medium">
            یادداشت بروزرسانی (اختیاری)
          </label>
          <Textarea
            id={`price-note-${brokerId}`}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="مثلاً قیمت‌های جدید ثبت شد…"
            className="text-sm"
          />
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-start">
          <Button
            type="button"
            disabled={update.isPending}
            onClick={() => update.mutate()}
            className="h-11 flex-1"
          >
            {update.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            ثبت بروزرسانی
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="h-11 flex-1"
          >
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
