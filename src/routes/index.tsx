import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Home, KeyRound, Loader2, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PropertyCard } from "@/components/PropertyCard";
import { faDate, faDigits } from "@/lib/fa";
import { fetchProperties, PROPERTY_TYPE_LABELS, type Property } from "@/lib/properties";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "داشبورد املاک صدرا | مدیریت فایل‌های ملکی" },
      {
        name: "description",
        content:
          "داشبورد مدیریت املاک شهر صدرای شیراز: آمار فایل‌های فعال، فروش‌رفته و اجاره‌داده‌شده به همراه آخرین ثبت‌ها.",
      },
      { property: "og:title", content: "داشبورد املاک صدرا" },
      {
        property: "og:description",
        content: "آمار و آخرین فایل‌های ملکی مشاور املاک در شهر صدرای شیراز.",
      },
    ],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  return <AuthGate>{() => <Dashboard />}</AuthGate>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Home;
  tone: string;
}) {
  return (
    <div className="surface-card p-3">
      <div className={`flex size-8 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="size-4" />
      </div>
      <p className="mt-2 text-xl font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: fetchProperties,
  });

  const items = data ?? [];
  const active = items.filter((item) => item.status === "active");
  const sold = items.filter((item) => item.status === "sold");
  const rented = items.filter((item) => item.status === "rented");

  const byType = (Object.keys(PROPERTY_TYPE_LABELS) as Array<keyof typeof PROPERTY_TYPE_LABELS>)
    .map((type) => ({
      type,
      count: active.filter((item) => item.property_type === type).length,
    }))
    .filter((row) => row.count > 0);

  return (
    <AppShell title="داشبورد" subtitle={`امروز ${faDate(new Date())}`}>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="فایل فعال"
              value={faDigits(active.length)}
              icon={Home}
              tone="bg-success/15 text-success"
            />
            <StatCard
              label="کل فایل‌ها"
              value={faDigits(items.length)}
              icon={TrendingUp}
              tone="bg-primary/15 text-primary"
            />
            <StatCard
              label="فروش رفته"
              value={faDigits(sold.length)}
              icon={CheckCircle2}
              tone="bg-destructive/15 text-destructive"
            />
            <StatCard
              label="اجاره داده شده"
              value={faDigits(rented.length)}
              icon={KeyRound}
              tone="bg-warning/15 text-warning"
            />
          </div>

          {byType.length ? (
            <section className="surface-card p-4">
              <h2 className="text-sm font-bold">فایل‌های فعال بر اساس نوع</h2>
              <div className="mt-3 space-y-2">
                {byType.map((row) => (
                  <div key={row.type} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">
                      {PROPERTY_TYPE_LABELS[row.type]}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(row.count / active.length) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-end text-xs font-semibold">
                      {faDigits(row.count)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">آخرین فایل‌ها</h2>
              <Link to="/listings" className="text-xs font-medium text-primary">
                مشاهده همه
              </Link>
            </div>
            {items.slice(0, 5).map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
            {!items.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                هنوز ملکی ثبت نشده است.
              </p>
            ) : null}
          </section>
        </div>
      )}
    </AppShell>
  );
}
