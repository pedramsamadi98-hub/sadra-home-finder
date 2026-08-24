import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Loader2, Lock, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { usePhotoUrls } from "@/components/PhotoGallery";
import { Button } from "@/components/ui/button";
import {
  deletePrivatePhoto,
  fetchPhotoVisibility,
  movePhotoToPrivate,
  movePhotoToPublic,
  setPhotoVisibility,
  type Property,
} from "@/lib/properties";

/**
 * Admin-only surface for the private OCR images plus classification of legacy
 * images whose type was never recorded. Collaborators never render this.
 */
export function PrivatePhotoSection({ property }: { property: Property }) {
  const queryClient = useQueryClient();
  const paths = [...property.photos, ...property.private_photos];

  const { data: visibility } = useQuery({
    queryKey: ["photo-visibility", paths],
    queryFn: () => fetchPhotoVisibility(paths),
    enabled: paths.length > 0,
  });

  const unclassified = property.photos.filter((path) => !visibility?.[path]);
  const { data: privateUrls } = usePhotoUrls(property.private_photos);
  const { data: unclassifiedUrls } = usePhotoUrls(unclassified);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["property", property.id] });
    await queryClient.invalidateQueries({ queryKey: ["properties"] });
    await queryClient.invalidateQueries({ queryKey: ["photo-visibility"] });
  }

  const markPrivate = useMutation({
    mutationFn: (path: string) => movePhotoToPrivate(property, path),
    onSuccess: async () => {
      await refresh();
      toast.success("تصویر به بخش خصوصی / OCR منتقل شد");
    },
    onError: () => toast.error("تغییر نوع تصویر ناموفق بود"),
  });

  const markPublic = useMutation({
    mutationFn: (path: string) =>
      property.private_photos.includes(path)
        ? movePhotoToPublic(property, path)
        : setPhotoVisibility(path, property.user_id ?? "", "public_listing", property.id),
    onSuccess: async () => {
      await refresh();
      toast.success("تصویر به‌عنوان «قابل نمایش» ثبت شد");
    },
    onError: () => toast.error("تغییر نوع تصویر ناموفق بود"),
  });

  const removePrivate = useMutation({
    mutationFn: (path: string) => deletePrivatePhoto(property, path),
    onSuccess: async () => {
      await refresh();
      toast.success("تصویر خصوصی حذف شد");
    },
    onError: () => toast.error("حذف تصویر ناموفق بود"),
  });

  const busy =
    markPrivate.isPending || markPublic.isPending || removePrivate.isPending;

  if (!property.private_photos.length && !unclassified.length) return null;

  return (
    <section className="surface-card space-y-4 border border-destructive/40 p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-destructive" />
        <h2 className="text-sm font-bold text-destructive">تصاویر خصوصی / OCR</h2>
        {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </div>
      <p className="text-[11px] text-muted-foreground">
        این تصاویر فقط برای مدیر قابل مشاهده‌اند و هرگز در اختیار همکار قرار نمی‌گیرند.
      </p>

      {property.private_photos.length ? (
        <div className="grid grid-cols-2 gap-2">
          {property.private_photos.map((path, index) => (
            <div key={path} className="relative overflow-hidden rounded-xl">
              {privateUrls?.[index] ? (
                <img
                  src={privateUrls[index]}
                  alt={`تصویر خصوصی ${index + 1}`}
                  className="h-36 w-full object-cover"
                />
              ) : (
                <div className="h-36 w-full animate-pulse bg-secondary" />
              )}
              <span className="absolute bottom-1 start-1 flex items-center gap-1 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                <EyeOff className="size-3" />
                خصوصی / OCR
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => removePrivate.mutate(path)}
                className="absolute end-1 top-1 rounded-md bg-background/90 p-1 text-destructive"
                aria-label="حذف تصویر خصوصی"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">تصویر خصوصی ثبت نشده است.</p>
      )}

      {unclassified.length ? (
        <div className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <p className="flex items-center gap-1 text-xs font-bold text-foreground">
            <ShieldAlert className="size-3.5 text-primary" />
            تصاویر تعیین‌نشده ({unclassified.length})
          </p>
          <p className="text-[11px] text-muted-foreground">
            نوع این تصاویر قبلاً ثبت نشده است؛ تا زمانی که شما تعیین نکنید برای همکار
            نمایش داده نمی‌شوند.
          </p>
          <div className="grid gap-2">
            {unclassified.map((path, index) => (
              <div key={path} className="flex items-center gap-2">
                {unclassifiedUrls?.[index] ? (
                  <img
                    src={unclassifiedUrls[index]}
                    alt={`تصویر تعیین‌نشده ${index + 1}`}
                    className="size-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="size-16 shrink-0 animate-pulse rounded-xl bg-secondary" />
                )}
                <div className="flex flex-1 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => markPublic.mutate(path)}
                  >
                    قابل نمایش
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => markPrivate.mutate(path)}
                  >
                    خصوصی / OCR
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
