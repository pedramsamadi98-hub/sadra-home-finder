import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, Phone, Plus, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminOnly } from "@/components/AdminOnly";
import { Button } from "@/components/ui/button";
import { PropertyCard } from "@/components/PropertyCard";
import { fetchBrokers } from "@/lib/brokers";
import { faDigits } from "@/lib/fa";
import { fetchProperties, STATUS_LABELS, type PropertyStatus } from "@/lib/properties";

export const Route = createFileRoute("/brokers_/$id")({
  head: () => ({
    meta: [
      { title: "پرونده دلال | املاک صدرا" },
      {
        name: "description",
        content: "مشاهده اطلاعات دلال و همه فایل‌های ملکی مرتبط با او به‌همراه تعداد هر وضعیت.",
      },
      { property: "og:title", content: "پرونده دلال" },
      {
        property: "og:description",
        content: "فایل‌های ملکی هر دلال با تفکیک وضعیت فعال، فروخته‌شده، اجاره‌داده‌شده و بایگانی.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    due: search["due"] === true || search["due"] === "true" ? true : undefined,
  }),
  component: () => <AdminOnly>{() => <BrokerDetail />}</AdminOnly>,
});

function BrokerDetail() {
  const { id } = Route.useParams();
  const { data: brokers, isLoading: loadingBrokers } = useQuery({
    queryKey: ["brokers"],
    queryFn: fetchBrokers,
  });
  const { data: properties, isLoading: loadingProps } = useQuery({
    queryKey: ["properties"],
    queryFn: fetchProperties,
  });

  const broker = brokers?.find((item) => item.id === id) ?? null;
  const files = (properties ?? []).filter((item) => item.broker_id === id);
  const counts = (Object.keys(STATUS_LABELS) as PropertyStatus[]).map((status) => ({
    status,
    count: files.filter((item) => item.status === status).length,
  }));

  if (loadingBrokers || loadingProps) {
    return (
      <AppShell title="دلال">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!broker) {
    return (
      <AppShell title="دلال">
        <p className="surface-card p-6 text-center text-sm text-muted-foreground">
          این دلال پیدا نشد.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={broker.name}
      subtitle={broker.agency ?? `${faDigits(files.length)} فایل ملکی`}
    >
      <div className="space-y-4">
        <section className="surface-card space-y-3 p-4">
          <div className="flex items-start gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Users className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{broker.name}</p>
              {broker.agency ? (
                <p className="truncate text-xs text-muted-foreground">{broker.agency}</p>
              ) : null}
            </div>
          </div>
          {broker.phone ? (
            <a
              href={`tel:${broker.phone}`}
              className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
            >
              <Phone className="size-4" />
              <span dir="ltr">{faDigits(broker.phone)}</span>
            </a>
          ) : null}
          {broker.notes ? (
            <p className="text-xs leading-6 text-muted-foreground">{broker.notes}</p>
          ) : null}
        </section>

        <section className="surface-card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-sm font-bold">فایل‌های این دلال</h2>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              {faDigits(files.length)} فایل
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {counts.map(({ status, count }) => (
              <span
                key={status}
                className="rounded-lg bg-secondary/70 px-2 py-1 text-[11px] text-muted-foreground"
              >
                {STATUS_LABELS[status]}: {faDigits(count)}
              </span>
            ))}
          </div>
        </section>

        {files.length ? (
          <div className="space-y-3">
            {files.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <p className="surface-card p-6 text-center text-sm text-muted-foreground">
            هنوز فایلی برای این دلال ثبت نشده است.
          </p>
        )}

        <Button asChild variant="secondary" className="h-11 w-full">
          <Link to="/listings/new" search={{ broker: broker.id }}>
            <Plus className="size-4" />
            افزودن فایل برای این دلال
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
