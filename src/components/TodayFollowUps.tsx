import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Check, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";

import { PRIORITY_TONE, STATUS_TONE } from "@/components/FollowUpSection";
import { Button } from "@/components/ui/button";
import { fetchBrokers } from "@/lib/brokers";
import { faDateTime, faDigits } from "@/lib/fa";
import {
  completeFollowUp,
  dueBucket,
  fetchFollowUps,
  FOLLOW_UP_PRIORITY_LABELS,
  FOLLOW_UP_STATUS_LABELS,
  sortFollowUps,
  type DueBucket,
  type FollowUp,
} from "@/lib/follow-ups";
import { fetchProperties, type Property } from "@/lib/properties";

const BUCKET_LABELS: Record<Exclude<DueBucket, "later">, string> = {
  overdue: "عقب‌افتاده",
  today: "امروز",
  tomorrow: "فردا",
};

export function TodayFollowUps({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const { data: followUps, isLoading } = useQuery({
    queryKey: ["follow_ups"],
    queryFn: () => fetchFollowUps(),
  });
  const { data: properties } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: fetchProperties,
  });
  const { data: brokers } = useQuery({ queryKey: ["brokers"], queryFn: fetchBrokers });

  const complete = useMutation({
    mutationFn: (id: string) => completeFollowUp(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["follow_ups"] });
      toast.success("پیگیری انجام شد");
    },
    onError: () => toast.error("تغییر وضعیت ناموفق بود"),
  });

  const buckets: Record<Exclude<DueBucket, "later">, FollowUp[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
  };
  for (const item of followUps ?? []) {
    const bucket = dueBucket(item);
    if (bucket && bucket !== "later") buckets[bucket].push(item);
  }

  const total =
    buckets.overdue.length + buckets.today.length + buckets.tomorrow.length;

  if (isLoading) {
    return (
      <section className="surface-card p-4">
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <CalendarClock className="size-4 text-primary" />
          پیگیری‌های امروز
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {faDigits(total)} مورد
        </span>
      </div>

      {!total ? (
        <p className="surface-card p-4 text-center text-xs text-muted-foreground">
          پیگیری عقب‌افتاده یا نزدیکی وجود ندارد.
        </p>
      ) : null}

      {(Object.keys(BUCKET_LABELS) as Array<Exclude<DueBucket, "later">>).map((key) => {
        const list = sortFollowUps(buckets[key], "priority");
        if (!list.length) return null;
        return (
          <div key={key} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {BUCKET_LABELS[key]} ({faDigits(list.length)})
            </p>
            {list.map((item) => {
              const property = properties?.find((p) => p.id === item.property_id) ?? null;
              const isOwner = !!property && property.user_id === userId;
              const broker =
                brokers?.find((b) => b.id === property?.broker_id) ?? null;
              return (
                <div
                  key={item.id}
                  className="surface-card space-y-2 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    {property ? (
                      <Link
                        to="/listings/$id"
                        params={{ id: property.id }}
                        className="text-sm font-bold text-primary"
                      >
                        {property.title}
                      </Link>
                    ) : (
                      <span className="text-sm font-bold">فایل نامشخص</span>
                    )}
                    <span
                      className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium ${PRIORITY_TONE[item.priority]}`}
                    >
                      {FOLLOW_UP_PRIORITY_LABELS[item.priority]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`rounded-lg px-2 py-0.5 font-medium ${STATUS_TONE[item.status]}`}
                    >
                      {FOLLOW_UP_STATUS_LABELS[item.status]}
                    </span>
                    <span className="text-muted-foreground">
                      {faDateTime(item.next_at)}
                    </span>
                  </div>

                  {isOwner ? (
                    <p className="text-[11px] text-muted-foreground">
                      منبع فایل: {broker ? broker.name : "فایل شخصی"}
                    </p>
                  ) : null}

                  {isOwner && property?.owner_phone ? (
                    <a
                      href={`tel:${property.owner_phone}`}
                      className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
                    >
                      <Phone className="size-4" />
                      <span dir="ltr">{faDigits(property.owner_phone)}</span>
                    </a>
                  ) : null}

                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-9 w-full"
                    disabled={complete.isPending}
                    onClick={() => complete.mutate(item.id)}
                  >
                    <Check className="size-4" />
                    انجام شد
                  </Button>
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
