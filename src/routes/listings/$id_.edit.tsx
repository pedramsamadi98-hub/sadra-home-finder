import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PropertyForm } from "@/components/PropertyForm";
import { fetchProperty, updateProperty, type PropertyInput } from "@/lib/properties";

export const Route = createFileRoute("/listings/$id_/edit")({
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
      {error.message}
    </div>
  ),
});

function EditRoute() {
  return <AuthGate>{(userId) => <EditProperty userId={userId} />}</AuthGate>;
}

function EditProperty({ userId }: { userId: string }) {
  const { id } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: property, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: () => fetchProperty(id),
  });

  const mutation = useMutation({
    mutationFn: (input: PropertyInput) => updateProperty(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      await queryClient.invalidateQueries({ queryKey: ["property", id] });
      toast.success("تغییرات ذخیره شد");
      router.navigate({ to: "/listings/$id", params: { id } });
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
