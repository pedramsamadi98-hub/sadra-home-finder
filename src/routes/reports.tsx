import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ImageOff,
  Loader2,
  UserRound,
  Users,
} from "lucide-react";

import { AdminOnly } from "@/components/AdminOnly";
import { AppShell } from "@/components/AppShell";
import { fetchBrokers, type Broker } from "@/lib/brokers";
import {
  bestMatch,
  CUSTOMER_STATUS_LABELS,
  fetchCustomers,
  fetchRequirements,
  MATCH_THRESHOLD,
  REQ_TRANSACTION_LABELS,
  type Customer,
  type CustomerRequirement,
  type CustomerStatus,
  type ReqTransactionType,
} from "@/lib/customers";
import { faDateTime, faDigits } from "@/lib/fa";
import {
  dueBucket,
  fetchFollowUps,
  FOLLOW_UP_PRIORITY_LABELS,
  type FollowUp,
} from "@/lib/follow-ups";
import {
  fetchProperties,
  OWNERSHIP_LABELS,
  STATUS_LABELS,
  TRANSACTION_LABELS,
  type Property,
  type PropertyStatus,
  type TransactionType,
} from "@/lib/properties";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "آمار و گزارش | املاک صدرا" },
      {
        name: "description",
        content:
          "گزارش وضعیت فایل‌های ملکی، مشتری‌ها، دلال‌ها و پیگیری‌ها بر اساس داده‌های واقعی سیستم املاک صدرا.",
      },
      { property: "og:title", content: "آمار و گزارش املاک صدرا" },
      {
        property: "og:description",
        content: "داشبورد آماری فایل‌ها، مشتری‌ها، دلال‌ها و پیگیری‌های مشاور املاک.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsRoute,
});

function ReportsRoute() {
  return <AdminOnly>{() => <Reports />}</AdminOnly>;
}

/* --------------------------------- pieces --------------------------------- */

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
  tone: string;
}) {
  return (
    <div className="surface-card p-3">
      <div className={`flex size-8 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="size-4" />
      </div>
      <p className="mt-2 text-xl font-bold">{faDigits(value)}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{faDigits(value)}</span>
    </div>
  );
}

/* --------------------------------- report --------------------------------- */

function Reports() {
  const properties = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: fetchProperties,
  });
  const customers = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
  });
  const requirements = useQuery<CustomerRequirement[]>({
    queryKey: ["requirements"],
    queryFn: () => fetchRequirements(),
  });
  const brokers = useQuery<Broker[]>({ queryKey: ["brokers"], queryFn: fetchBrokers });
  const followUps = useQuery<FollowUp[]>({
    queryKey: ["follow-ups", "all"],
    queryFn: () => fetchFollowUps(),
  });

  const loading =
    properties.isLoading ||
    customers.isLoading ||
    requirements.isLoading ||
    brokers.isLoading ||
    followUps.isLoading;

  if (loading) {
    return (
      <AppShell title="آمار و گزارش" subtitle="در حال محاسبه">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const props = properties.data ?? [];
  const custs = customers.data ?? [];
  const reqs = requirements.data ?? [];
  const brs = brokers.data ?? [];
  const fups = followUps.data ?? [];

  /* files */
  const byStatus = (status: PropertyStatus) => props.filter((p) => p.status === status).length;
  const withPhotos = props.filter((p) => (p.photos?.length ?? 0) > 0).length;
  const melki = props.filter((p) => p.ownership_type === "melki").length;
  const owqaf = props.filter((p) => p.ownership_type === "owqaf").length;
  const unknownOwnership = props.length - melki - owqaf;
  const byTransaction = (t: TransactionType) =>
    props.filter((p) => p.transaction_type === t).length;

  /* customers */
  const customerStatus = (status: CustomerStatus) =>
    custs.filter((c) => c.status === status).length;
  const demand = (t: ReqTransactionType) => reqs.filter((r) => r.transaction_type === t).length;
  const matchedCustomers = custs.filter((customer) => {
    const own = reqs.filter((r) => r.customer_id === customer.id);
    if (!own.length) return false;
    return props.some((property) => {
      const best = bestMatch(property, own);
      return best !== null && best.result.score >= MATCH_THRESHOLD;
    });
  });

  /* follow-ups */
  const pending = fups.filter((f) => f.status === "pending");
  const overdue = pending.filter((f) => dueBucket(f) === "overdue");
  const today = pending.filter((f) => dueBucket(f) === "today");
  const tomorrow = pending.filter((f) => dueBucket(f) === "tomorrow");
  const done = fups.filter((f) => f.status === "done");
  const canceled = fups.filter((f) => f.status === "canceled");

  const propertyTitle = (id: string | null) =>
    props.find((p) => p.id === id)?.title ?? null;
  const customerName = (id: string | null) =>
    custs.find((c) => c.id === id)?.full_name ?? null;

  function FollowUpGroup({
    label,
    items,
    tone,
  }: {
    label: string;
    items: FollowUp[];
    tone: string;
  }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className={`rounded-md px-2 py-1 font-semibold ${tone}`}>{label}</span>
          <span className="font-bold">{faDigits(items.length)}</span>
        </div>
        {items.slice(0, 3).map((item) => {
          const title =
            propertyTitle(item.property_id) ?? customerName(item.customer_id) ?? "بدون عنوان";
          const rowClass =
            "flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-[11px]";
          const body = (
            <>
              <span className="truncate">{title}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {item.next_at ? faDateTime(item.next_at) : FOLLOW_UP_PRIORITY_LABELS[item.priority]}
              </span>
            </>
          );
          if (item.property_id) {
            return (
              <Link
                key={item.id}
                to="/listings/$id"
                params={{ id: item.property_id }}
                className={rowClass}
              >
                {body}
              </Link>
            );
          }
          if (item.customer_id) {
            return (
              <Link
                key={item.id}
                to="/customers/$id"
                params={{ id: item.customer_id }}
                className={rowClass}
              >
                {body}
              </Link>
            );
          }
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-[11px]"
            >
              {body}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AppShell title="آمار و گزارش" subtitle="بر اساس داده‌های واقعی سیستم">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard
            label="فایل‌ها"
            value={props.length}
            icon={Building2}
            tone="bg-primary/15 text-primary"
          />
          <SummaryCard
            label="مشتری‌ها"
            value={custs.length}
            icon={UserRound}
            tone="bg-success/15 text-success"
          />
          <SummaryCard
            label="دلال‌ها"
            value={brs.length}
            icon={Users}
            tone="bg-secondary text-foreground"
          />
          <SummaryCard
            label="پیگیری امروز"
            value={today.length}
            icon={CalendarClock}
            tone="bg-warning/15 text-warning"
          />
          <SummaryCard
            label="عقب‌افتاده"
            value={overdue.length}
            icon={BarChart3}
            tone="bg-destructive/15 text-destructive"
          />
          <SummaryCard
            label="پیگیری انجام‌شده"
            value={done.length}
            icon={CheckCircle2}
            tone="bg-success/15 text-success"
          />
        </div>

        <Section title="گزارش فایل‌ها" icon={Building2}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Row label="کل فایل‌ها" value={props.length} />
            {(Object.keys(STATUS_LABELS) as PropertyStatus[]).map((status) => (
              <Row key={status} label={STATUS_LABELS[status]} value={byStatus(status)} />
            ))}
            <Row label={OWNERSHIP_LABELS.melki} value={melki} />
            <Row label={OWNERSHIP_LABELS.owqaf} value={owqaf} />
            {unknownOwnership > 0 ? (
              <Row label="نوع ملک ثبت‌نشده" value={unknownOwnership} />
            ) : null}
            {(Object.keys(TRANSACTION_LABELS) as TransactionType[]).map((t) => (
              <Row key={t} label={`معامله: ${TRANSACTION_LABELS[t]}`} value={byTransaction(t)} />
            ))}
            <Row label="دارای عکس" value={withPhotos} />
            <Row label="بدون عکس" value={props.length - withPhotos} />
          </div>
        </Section>

        <Section title="گزارش مشتری‌ها" icon={UserRound}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Row label="کل مشتری‌ها" value={custs.length} />
            {(Object.keys(CUSTOMER_STATUS_LABELS) as CustomerStatus[]).map((status) => (
              <Row
                key={status}
                label={CUSTOMER_STATUS_LABELS[status]}
                value={customerStatus(status)}
              />
            ))}
            <Row label="نیازهای ثبت‌شده" value={reqs.length} />
            {(Object.keys(REQ_TRANSACTION_LABELS) as ReqTransactionType[]).map((t) => (
              <Row key={t} label={`درخواست: ${REQ_TRANSACTION_LABELS[t]}`} value={demand(t)} />
            ))}
            <Row label="مشتری با فایل مناسب" value={matchedCustomers.length} />
          </div>
          {matchedCustomers.length ? (
            <div className="space-y-2">
              {matchedCustomers.slice(0, 3).map((customer) => (
                <Link
                  key={customer.id}
                  to="/customers/$id"
                  params={{ id: customer.id }}
                  className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-[11px]"
                >
                  <span className="truncate">{customer.full_name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {CUSTOMER_STATUS_LABELS[customer.status]}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </Section>

        <Section title="گزارش پیگیری‌ها" icon={CalendarClock}>
          <div className="space-y-3">
            <FollowUpGroup
              label="عقب‌افتاده"
              items={overdue}
              tone="bg-destructive/15 text-destructive"
            />
            <FollowUpGroup label="امروز" items={today} tone="bg-warning/15 text-warning" />
            <FollowUpGroup label="فردا" items={tomorrow} tone="bg-primary/15 text-primary" />
            <FollowUpGroup label="انجام‌شده" items={done} tone="bg-success/15 text-success" />
            <FollowUpGroup
              label="لغوشده"
              items={canceled}
              tone="bg-muted text-muted-foreground"
            />
          </div>
        </Section>

        {props.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <ImageOff className="size-4" /> هنوز فایلی ثبت نشده است.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
