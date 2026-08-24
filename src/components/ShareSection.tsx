import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Copy, Link2, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { faDateTime } from "@/lib/fa";
import { fetchCustomers } from "@/lib/customers";
import { createPropertyShare, type ShareDuration } from "@/lib/shares.functions";
import {
  fetchPropertyShares,
  revokePropertyShare,
  SHARE_DURATION_LABELS,
  SHARE_STATE_LABELS,
  shareState,
} from "@/lib/shares";

const DURATIONS: ShareDuration[] = ["1h", "24h", "3d", "7d", "never"];

export function ShareSection({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const create = useServerFn(createPropertyShare);

  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState<ShareDuration>("24h");
  const [customerId, setCustomerId] = useState<string>("");
  const [freshLink, setFreshLink] = useState<string | null>(null);

  const { data: shares, isLoading } = useQuery({
    queryKey: ["property-shares", propertyId],
    queryFn: () => fetchPropertyShares(propertyId),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
    enabled: open,
  });

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("لینک کپی شد");
    } catch {
      toast.error("کپی ناموفق بود");
    }
  }

  const creation = useMutation({
    mutationFn: () =>
      create({ data: { propertyId, duration, customerId: customerId || null } }),
    onSuccess: async (result) => {
      const url = `${window.location.origin}/share/${result.token}`;
      setFreshLink(url);
      setOpen(false);
      await copy(url);
      await queryClient.invalidateQueries({ queryKey: ["property-shares", propertyId] });
    },
    onError: (error: Error) => toast.error(error.message || "ایجاد لینک ناموفق بود"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokePropertyShare(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["property-shares", propertyId] });
      toast.success("لینک لغو شد");
    },
    onError: () => toast.error("لغو لینک ناموفق بود"),
  });

  return (
    <section className="surface-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Share2 className="size-4 text-primary" />
        لینک‌های اشتراک‌گذاری
      </h2>
      <p className="text-xs text-muted-foreground">
        فقط اطلاعات عمومی ملک به اشتراک گذاشته می‌شود؛ اطلاعات مالک، دلال، مشتری و تصاویر خصوصی
        هرگز ارسال نمی‌شود.
      </p>

      {!open ? (
        <Button type="button" className="h-11 w-full" onClick={() => setOpen(true)}>
          <Share2 className="size-4" />
          اشتراک‌گذاری امن
        </Button>
      ) : (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <p className="text-xs font-semibold">مدت اعتبار لینک</p>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDuration(key)}
                className={`h-10 rounded-xl border text-xs font-medium transition-colors ${
                  duration === key
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {SHARE_DURATION_LABELS[key]}
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold">مشتری (اختیاری — فقط ثبت داخلی)</span>
            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">انتخاب نشده</option>
              {(customers ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <Button
              type="button"
              className="h-10 flex-1"
              disabled={creation.isPending}
              onClick={() => creation.mutate()}
            >
              {creation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              ساخت لینک
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => setOpen(false)}
            >
              انصراف
            </Button>
          </div>
        </div>
      )}

      {freshLink ? (
        <div className="space-y-2 rounded-xl bg-primary/10 p-3">
          <p className="text-xs font-semibold text-primary">
            لینک ساخته شد — این لینک فقط همین یک بار نمایش داده می‌شود.
          </p>
          <p dir="ltr" className="break-all text-xs text-muted-foreground">
            {freshLink}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="h-9 w-full"
            onClick={() => copy(freshLink)}
          >
            <Copy className="size-4" />
            کپی لینک
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : (shares ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">هنوز لینکی ساخته نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {(shares ?? []).map((share) => {
            const state = shareState(share);
            return (
              <li key={share.id} className="space-y-2 rounded-xl bg-secondary/60 p-3">
                <div className="flex items-center gap-2 text-xs">
                  <Link2 className="size-4 text-primary" />
                  <span
                    className={`rounded-lg px-2 py-0.5 font-semibold ${
                      state === "active"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {SHARE_STATE_LABELS[state]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  ایجاد: {faDateTime(share.created_at)}
                </p>
                <p className="text-xs text-muted-foreground">
                  انقضا: {share.expires_at ? faDateTime(share.expires_at) : "بدون انقضا"}
                </p>
                {state === "active" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(share.id)}
                  >
                    <Ban className="size-4" />
                    لغو لینک
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
