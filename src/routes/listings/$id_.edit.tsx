import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AdminOnly } from "@/components/AdminOnly";
import { PropertyForm } from "@/components/PropertyForm";
import { fetchBrokers } from "@/lib/brokers";
import { faDate } from "@/lib/fa";
import { fetchProperty, updateProperty, type Property, type PropertyInput } from "@/lib/properties";

const clean = (v: string | null | undefined) => (v ?? "").trim();

/**
 * Previous owner / broker lines for the private admin notes. Compares the
 * LATEST persisted record with the submitted values, owner and broker
 * independently; a line is added only when the old value was non-empty and
 * really differs (clearing a value keeps the old one). No name matching, so a
 * retry after a successful save adds nothing — the persisted values already match.
 */
export function historyLines(
  latest: Pick<Property, "owner_name" | "owner_phone" | "broker_id">,
  next: Pick<PropertyInput, "owner_name" | "owner_phone" | "broker_id">,
  brokerName: (id: string) => string,
  date: string,
): string[] {
  const lines: string[] = [];
  const oldName = clean(latest.owner_name);
  const oldPhone = clean(latest.owner_phone);
  if ((oldName || oldPhone) && (oldName !== clean(next.owner_name) || oldPhone !== clean(next.owner_phone))) {
    lines.push(`مالک قبلی (${date}): ${[oldName, oldPhone].filter(Boolean).join(" — ")}`);
  }
  const oldBroker = latest.broker_id ?? null;
  if (oldBroker && oldBroker !== (next.broker_id ?? null)) {
    lines.push(`دلال قبلی (${date}): ${brokerName(oldBroker)}`);
  }
  return lines;
}

export const Route = createFileRoute("/listings/$id_/edit")({
  /** Optional broker context so «برگشت» lands on that broker's file list. */
  validateSearch: (search: Record<string, unknown>): { broker?: string } =>
    typeof search["broker"] === "string" && search["broker"]
      ? { broker: search["broker"] }
      : {},
  head: () => ({
    meta: [
      { title: "ویرایش ملک | املاک صدرا" },
      {
        name: "description",
        content: "ویرایش مشخصات، قیمت، تصاویر و اطلاعات مالک فایل ملکی ثبت‌شده.",
      },
      { property: "og:title", content: "ویرایش ملک" },
      {
        property: "og:description",
        content: "به‌روزرسانی اطلاعات فایل ملکی در سامانه املاک صدرا.",
      },
    ],
  }),
  component: EditRoute,
  errorComponent: ({ error }) => (
    <div className="p-6 text-center text-sm text-destructive" role="alert">
      {(error as Error).message}
    </div>
  ),
});

function EditRoute() {
  return <AdminOnly>{(userId) => <EditProperty userId={userId} />}</AdminOnly>;
}

function EditProperty({ userId }: { userId: string }) {
  const { id } = Route.useParams();
  const { broker } = Route.useSearch();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: property, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: () => fetchProperty(id),
  });

  const mutation = useMutation({
    mutationFn: async (input: PropertyInput) => {
      // Re-read the persisted record right before saving (not the form's copy).
      const latest = await fetchProperty(id);
      const brokers = latest.broker_id && latest.broker_id !== input.broker_id ? await fetchBrokers() : [];
      const lines = historyLines(
        latest,
        input,
        (bid) => brokers.find((b) => b.id === bid)?.name ?? "نامشخص",
        faDate(new Date()),
      );
      // Notes start from the latest saved notes; a manager's own edit in this
      // form wins. Last-write-wins: a concurrent notes edit elsewhere between
      // this read and the update can still be overwritten.
      const formEdited = clean(input.notes) !== clean(property?.notes);
      const base = formEdited ? (input.notes ?? "") : (latest.notes ?? "");
      const notes = lines.length ? [base.trimEnd(), ...lines].filter(Boolean).join("\n") : base;
      // One update carries both the property changes and the history lines.
      await updateProperty(id, { ...input, notes });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      await queryClient.invalidateQueries({ queryKey: ["property", id] });
      toast.success("تغییرات ذخیره شد");
      router.navigate({
        to: "/listings/$id",
        params: { id },
        search: broker ? { broker } : {},
      });
    },
    onError: () => toast.error("ذخیره تغییرات ناموفق بود"),
  });

  if (isLoading || !property) {
    return (
      <AppShell title="ویرایش ملک">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const {
    id: _id,
    user_id: _userId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    file_code: _fileCode,
    initial_date: _initialDate,
    verified_price: _verifiedPrice,
    price_verified_at: _priceVerifiedAt,
    // Cover choice is saved only by the dedicated selector, never by the form.
    cover_photo: _coverPhoto,
    ...initial
  } = property;

  return (
    <AppShell title="ویرایش ملک" subtitle={property.title}>
      <PropertyForm
        initial={initial}
        userId={userId}
        submitLabel="ذخیره تغییرات"
        submitting={mutation.isPending}
        onSubmit={(input) => mutation.mutate(input)}
      />
    </AppShell>
  );
}
