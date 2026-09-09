import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { faDigits, faRelative } from "@/lib/fa";
import {
  brokerFreshness,
  daysSinceUpdate,
  fetchBrokers,
  FRESHNESS_LABELS,
  FRESHNESS_TONE,
  needsUpdate,
  staleFirst,
  touchBroker,
} from "@/lib/brokers";

/**
 * Dashboard block that surfaces brokers whose prices / files have not been
 * refreshed recently, so no broker is ever forgotten.
 */
export function StaleBrokers() {
  const queryClient = useQueryClient();
  const { data: brokers, isLoading } = useQuery({
    queryKey: ["brokers"],
    queryFn: fetchBrokers,
  });

  const touch = useMutation({
    mutationFn: (id: string) => touchBroker(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["brokers"] });
      toast.success("بروزرسانی دلال ثبت شد");
    },
    onError: () => toast.error("ثبت بروزرسانی ناموفق بود"),
  });

  if (isLoading) return null;

  const all = brokers ?? [];
  const stale = all.filter(needsUpdate).sort(staleFirst);
  if (!stale.length) {
    if (!all.length) return null;
    return (
      <section className="surface-card flex items-center gap-2 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
          <Check className="size-4" />
        </div>
        <p className="text-xs text-muted-foreground">
          اطلاعات همه دلال‌ها بروز است ({faDigits(all.length)} دلال).
        </p>
        <Link to="/brokers" search={{ due: undefined }} className="ms-auto shrink-0 text-xs font-medium text-primary">
          دلال‌ها
        </Link>
      </section>
    );
  }


  return (
    <section className="surface-card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
          <RefreshCw className="size-4" />
        </div>
        <h2 className="text-sm font-bold">دلال‌های نیازمند بروزرسانی</h2>
        <span className="ms-auto rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning">
          {faDigits(stale.length)}
        </span>
      </div>

      <ul className="space-y-2">
        {stale.slice(0, 5).map((broker) => {
          const state = brokerFreshness(broker);
          const days = daysSinceUpdate(broker);
          return (
            <li key={broker.id} className="rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center gap-2">
                <Link
                  to="/brokers/$id"
                  params={{ id: broker.id }}
                  search={{ due: true }}
                  className="min-w-0 flex-1 text-sm font-bold"
                >
                  <span className="block truncate">{broker.name}</span>
                  <span className="block truncate text-[11px] font-normal text-muted-foreground">
                    {days === null
                      ? "تا امروز تماسی ثبت نشده"
                      : `آخرین بروزرسانی ${faRelative(broker.last_contact_at)} · ${faDigits(days)} روز`}
                  </span>
                </Link>
                <span
                  className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${FRESHNESS_TONE[state]}`}
                >
                  {FRESHNESS_LABELS[state]}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {broker.phone ? (
                  <a
                    href={`tel:${broker.phone}`}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 text-xs font-semibold text-primary"
                  >
                    <Phone className="size-3.5" />
                    تماس
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => touch.mutate(broker.id)}
                  disabled={touch.isPending}
                  className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold"
                >
                  {touch.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  بروزرسانی شد
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {stale.length > 5 ? (
        <Link
          to="/brokers"
          search={{ due: true }}
          className="block rounded-xl bg-secondary/60 py-2.5 text-center text-xs font-semibold text-primary"
        >
          مشاهده همه دلال‌های نیازمند بروزرسانی
        </Link>
      ) : null}
    </section>
  );
}
