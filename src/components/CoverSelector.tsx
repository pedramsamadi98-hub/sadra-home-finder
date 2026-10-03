import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { DefaultCover, usePhotoUrls } from "@/components/PhotoGallery";
import { resolvedCoverPath } from "@/lib/default-covers";
import { setPropertyCover, type Property } from "@/lib/properties";

/** Admin-only: choose the category default or one public photo as the cover. */
export function CoverSelector({ property }: { property: Property }) {
  const qc = useQueryClient();
  const current = resolvedCoverPath(property);
  const { data: urls } = usePhotoUrls(property.photos);
  const save = useMutation({
    mutationFn: (path: string | null) => setPropertyCover(property, path),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["property", property.id] });
      await qc.invalidateQueries({ queryKey: ["properties"] });
      toast.success("تصویر اصلی ذخیره شد");
    },
    onError: () => toast.error("ذخیره تصویر اصلی ناموفق بود"),
  });

  const tile = (selected: boolean, label: string, onClick: () => void, child: React.ReactNode, key: string) => (
    <button
      key={key}
      type="button"
      disabled={save.isPending}
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={`relative shrink-0 overflow-hidden rounded-xl border-2 ${selected ? "border-primary" : "border-transparent"}`}
    >
      {child}
      {selected ? (
        <span className="absolute end-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
          <Check className="size-3" />
        </span>
      ) : null}
    </button>
  );

  return (
    <section className="surface-card space-y-2 p-4">
      <h2 className="text-sm font-bold">تصویر اصلی</h2>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {tile(current === null, "تصویر پیش‌فرض دسته‌بندی", () => save.mutate(null),
          <DefaultCover type={property.property_type} className="size-20" />, "default")}
        {property.photos.map((path, i) =>
          tile(current === path, `عکس ${i + 1}`, () => save.mutate(path),
            urls?.[i] ? <img src={urls[i]} alt="" className="size-20 object-cover" /> : <div className="size-20 animate-pulse bg-secondary" />,
            path),
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">اضافه شدن عکس جدید تصویر اصلی را تغییر نمی‌دهد.</p>
    </section>
  );
}
