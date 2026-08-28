import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Building, Calendar, Car, Landmark, MapPin, Ruler, ShieldCheck } from "lucide-react";

import { faArea, faDate, faDigits, faPrice } from "@/lib/fa";
import { getSharedProperty } from "@/lib/shares.functions";
import {
  OWNERSHIP_LABELS,
  propertyTypeLabel,
  TRANSACTION_LABELS,
  type OwnershipType,
  type TransactionType,
} from "@/lib/properties";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "فایل ملکی اشتراکی | املاک صدرا" },
      {
        name: "description",
        content: "مشاهده اطلاعات عمومی یک فایل ملکی از طریق لینک اشتراکی امن.",
      },
      { property: "og:title", content: "فایل ملکی اشتراکی" },
      {
        property: "og:description",
        content: "اطلاعات عمومی فایل ملکی؛ اطلاعات خصوصی مالک نمایش داده نمی‌شود.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ params }) => getSharedProperty({ data: { token: params.token } }),
  component: SharePage,
  errorComponent: () => (
    <Notice title="این لینک معتبر نیست" text="لطفاً لینک را دوباره از فرستنده دریافت کنید." />
  ),
  notFoundComponent: () => <Notice title="این لینک معتبر نیست" text="" />,
});

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="surface-card w-full max-w-sm space-y-2 p-6 text-center">
        <h1 className="text-base font-bold">{title}</h1>
        {text ? <p className="text-sm text-muted-foreground">{text}</p> : null}
      </div>
    </main>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
      <Icon className="size-4 text-primary" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="ms-auto text-sm font-medium">{value}</span>
    </div>
  );
}

function SharePage() {
  const result = Route.useLoaderData();

  if (result.state === "expired") {
    return <Notice title="این لینک منقضی شده است" text="برای دریافت لینک جدید با ما تماس بگیرید." />;
  }
  if (result.state === "revoked") {
    return <Notice title="این لینک لغو شده است" text="دسترسی به این فایل بسته شده است." />;
  }
  if (result.state !== "ok") {
    return <Notice title="این لینک معتبر نیست" text="لطفاً لینک را دوباره بررسی کنید." />;
  }

  const p = result.property;

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg space-y-4 bg-background p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-bold">فایل ملکی</h1>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          این لینک اشتراکی است و اطلاعات خصوصی مالک نمایش داده نمی‌شود.
        </p>
      </header>

      {p.photos.length ? (
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
          {p.photos.map((url, index) => (
            <img
              key={url}
              src={url}
              alt={`${p.title} — تصویر ${faDigits(index + 1)}`}
              loading="lazy"
              className="h-44 w-72 shrink-0 snap-center rounded-2xl object-cover"
            />
          ))}
        </div>
      ) : null}

      <section className="surface-card space-y-2 p-4">
        <h2 className="text-base font-bold">{p.title}</h2>
        <p className="text-lg font-bold text-primary">
          {p.transaction_type === "sale" ? faPrice(p.price) : `${faPrice(p.deposit)} رهن`}
        </p>
        {p.transaction_type !== "sale" ? (
          <p className="text-sm text-muted-foreground">اجاره ماهانه: {faPrice(p.monthly_rent)}</p>
        ) : null}
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          {p.city}
          {p.phase ? ` — ${p.phase}` : ""}
          {p.neighborhood ? ` — ${p.neighborhood}` : ""}
        </p>
      </section>

      <section className="grid gap-2">
        <Row
          icon={propertyTypeIcon(p.property_type)}
          label="کاربری"
          value={`${propertyTypeLabel(p.property_type)} • ${
            TRANSACTION_LABELS[p.transaction_type as TransactionType]
          }`}
        />
        <Row
          icon={Landmark}
          label="نوع ملک"
          value={
            p.ownership_type ? OWNERSHIP_LABELS[p.ownership_type as OwnershipType] : "تعیین نشده"
          }
        />
        <Row icon={Ruler} label="متراژ" value={faArea(p.area)} />
        {p.bedrooms !== null ? (
          <Row icon={Boxes} label="اتاق خواب" value={faDigits(p.bedrooms)} />
        ) : null}
        {p.building_age !== null ? (
          <Row icon={Calendar} label="سن بنا" value={`${faDigits(p.building_age)} سال`} />
        ) : null}
        <Row
          icon={Car}
          label="امکانات"
          value={
            [
              p.parking ? "پارکینگ" : null,
              p.elevator ? "آسانسور" : null,
              p.storage ? "انباری" : null,
            ]
              .filter(Boolean)
              .join(" • ") || "—"
          }
        />
      </section>

      {p.description ? (
        <section className="surface-card p-4">
          <h2 className="text-sm font-bold">توضیحات</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{p.description}</p>
        </section>
      ) : null}

      <p className="pb-6 text-center text-[11px] text-muted-foreground">
        {faDate(new Date())}
      </p>
    </main>
  );
}
