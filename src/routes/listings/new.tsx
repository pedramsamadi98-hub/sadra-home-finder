import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PropertyForm } from "@/components/PropertyForm";
import { createProperty, emptyProperty, type PropertyInput } from "@/lib/properties";

export const Route = createFileRoute("/listings/new")({
  head: () => ({
    meta: [
      { title: "ثبت ملک جدید | املاک صدرا" },
      {
        name: "description",
        content: "ثبت سریع فایل ملکی جدید با مشخصات کامل، عکس و اطلاعات مالک در شهر صدرا.",
      },
      { property: "og:title", content: "ثبت ملک جدید" },
      {
        property: "og:description",
        content: "افزودن فایل ملکی جدید با مشخصات کامل و تصاویر.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    broker: typeof search.broker === "string" && search.broker ? search.broker : undefined,
  }),
  component: NewRoute,
});

function NewRoute() {
  const { broker } = Route.useSearch();
  return <AuthGate>{(userId) => <NewProperty userId={userId} brokerId={broker ?? null} />}</AuthGate>;
}

function NewProperty({ userId, brokerId }: { userId: string; brokerId: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: PropertyInput) => createProperty(input, userId),
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("ملک ثبت شد");
      router.navigate({ to: "/listings/$id", params: { id } });
    },
    onError: () => toast.error("ثبت ملک ناموفق بود"),
  });

  return (
    <AppShell title="ثبت ملک جدید" subtitle="اطلاعات فایل را کامل کنید">
      <PropertyForm
        initial={brokerId ? { ...emptyProperty, broker_id: brokerId } : emptyProperty}
        userId={userId}
        submitLabel="ثبت ملک"
        submitting={mutation.isPending}
        onSubmit={(input) => mutation.mutate(input)}
      />
    </AppShell>
  );
}
