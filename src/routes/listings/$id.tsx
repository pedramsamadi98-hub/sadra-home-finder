import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowUpRightFromSquare,
  Boxes,
  Building,
  Calendar,
  Car,
  Loader2,
  MapPin,
  MoveVertical,
  Phone,
  Ruler,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PhotoGallery } from "@/components/PhotoGallery";
import { Button } from "@/components/ui/button";
import { fetchBrokers } from "@/lib/brokers";
import { faArea, faDate, faDigits, faPrice } from "@/lib/fa";
import {
  deleteProperty,
  fetchProperty,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  TRANSACTION_LABELS,
} from "@/lib/properties";

export const Route = createFileRoute("/listings/$id")({
  head: () => ({
    meta: [
      { title: "جزئیات ملک | املاک صدرا" },
      {
        name: "description",
        content: "مشاهده کامل مشخصات ملک، تصاویر، امکانات و اطلاعات تماس مالک.",
      },
      { property: "og:title", content: "جزئیات ملک" },
      {
        property: "og:description",
        content: "مشخصات کامل فایل ملکی همراه با تصاویر و اطلاعات مالک.",
      },
    ],
  }),
  component: DetailRoute,
  errorComponent: ({ error }) => (
    <div className="p-6 text-center text-sm text-destructive" role="alert">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-center text-sm">ملک پیدا نشد</div>,
});

function DetailRoute() {
  return <AuthGate>{(userId) => <Detail userId={userId} />}</AuthGate>;
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

function Detail({ userId }: { userId: string }) {
  const { id } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: property, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: () => fetchProperty(id),
  });

  const removal = useMutation({
    mutationFn: () => deleteProperty(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("ملک حذف شد");
      router.navigate({ to: "/listings" });
    },
    onError: () => toast.error("حذف ناموفق بود"),
  });

  if (isLoading || !property) {
    return (
      <AppShell title="جزئیات ملک">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const isOwn = property.user_id === userId;

  return (
    <AppShell title={property.title} subtitle={STATUS_LABELS[property.status]}>
      <div className="space-y-4">
        <PhotoGallery paths={property.photos} alt={property.title} />

        <section className="surface-card space-y-2 p-4">
          <p className="text-lg font-bold text-primary">
            {property.transaction_type === "rent"
              ? `${faPrice(property.deposit)} رهن`
              : faPrice(property.price)}
          </p>
          {property.transaction_type === "rent" ? (
            <p className="text-sm text-muted-foreground">
              اجاره ماهانه: {faPrice(property.monthly_rent)}
            </p>
          ) : null}
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {property.city}
            {property.neighborhood ? ` — ${property.neighborhood}` : ""}
            {property.address ? ` — ${property.address}` : ""}
          </p>
        </section>

        <section className="grid gap-2">
          <Row
            icon={Building}
            label="نوع ملک"
            value={`${PROPERTY_TYPE_LABELS[property.property_type]} • ${TRANSACTION_LABELS[property.transaction_type]}`}
          />
          <Row icon={Ruler} label="متراژ" value={faArea(property.area)} />
          {property.bedrooms !== null ? (
            <Row icon={Boxes} label="اتاق خواب" value={faDigits(property.bedrooms)} />
          ) : null}
          {property.floor !== null ? (
            <Row icon={MoveVertical} label="طبقه" value={faDigits(property.floor)} />
          ) : null}
          {property.building_age !== null ? (
            <Row
              icon={Calendar}
              label="سن بنا"
              value={`${faDigits(property.building_age)} سال`}
            />
          ) : null}
          <Row
            icon={Car}
            label="امکانات"
            value={
              [
                property.parking ? "پارکینگ" : null,
                property.elevator ? "آسانسور" : null,
                property.storage ? "انباری" : null,
              ]
                .filter(Boolean)
                .join(" • ") || "—"
            }
          />
          <Row icon={Calendar} label="تاریخ ثبت" value={faDate(property.created_at)} />
        </section>

        {property.description ? (
          <section className="surface-card p-4">
            <h2 className="text-sm font-bold">توضیحات</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {property.description}
            </p>
          </section>
        ) : null}

        {property.notes ? (
          <section className="surface-card p-4">
            <h2 className="text-sm font-bold">یادداشت داخلی</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{property.notes}</p>
          </section>
        ) : null}

        <section className="surface-card space-y-3 p-4">
          <h2 className="text-sm font-bold">مالک</h2>
          <p className="flex items-center gap-2 text-sm">
            <User className="size-4 text-primary" />
            {property.owner_name || "—"}
          </p>
          {property.owner_phone ? (
            <a
              href={`tel:${property.owner_phone}`}
              className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
            >
              <Phone className="size-4" />
              <span dir="ltr">{faDigits(property.owner_phone)}</span>
              <ArrowUpRightFromSquare className="ms-auto size-3.5" />
            </a>
          ) : null}
        </section>

        {isOwn ? (
          <div className="flex gap-2">
            <Button asChild className="h-11 flex-1">
              <Link to="/listings/$id/edit" params={{ id: property.id }}>
                ویرایش
              </Link>
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              disabled={removal.isPending}
              onClick={() => {
                if (window.confirm("این ملک حذف شود؟")) removal.mutate();
              }}
            >
              {removal.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </div>
        ) : (
          <p className="rounded-xl bg-secondary/60 p-3 text-center text-xs text-muted-foreground">
            این یک فایل نمونه است و قابل ویرایش نیست.
          </p>
        )}
      </div>
    </AppShell>
  );
}
