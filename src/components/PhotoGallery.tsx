import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";

import { defaultCoverUrl, resolvedCoverPath } from "@/lib/default-covers";
import { signedPhotoUrls, propertyTypeLabel, type Property } from "@/lib/properties";
import { PropertyTypeIcon } from "@/lib/property-type-icons";

/** Category default cover: real asset if provided, else a styled type tile. */
export function DefaultCover({ type, className }: { type: string; className: string }) {
  const url = defaultCoverUrl(type);
  if (url) return <img src={url} alt={propertyTypeLabel(type)} className={`${className} object-cover`} />;
  return (
    <div className={`${className} flex flex-col items-center justify-center gap-1 bg-secondary text-primary`}>
      <PropertyTypeIcon type={type} className="size-6" />
      <span className="px-1 text-center text-[10px] text-muted-foreground">{propertyTypeLabel(type)}</span>
    </div>
  );
}

/** List thumbnail: manager-chosen real cover, otherwise category default. */
export function CoverThumb({ property }: { property: Property }) {
  const path = resolvedCoverPath(property);
  const { data } = usePhotoUrls(path ? [path] : []);
  if (path && data?.[0]) {
    return <img src={data[0]} alt={property.title} loading="lazy" className="size-20 shrink-0 rounded-xl object-cover" />;
  }
  return <DefaultCover type={property.property_type} className="size-20 shrink-0 rounded-xl" />;
}

export function usePhotoUrls(paths: string[]) {
  return useQuery({
    queryKey: ["photo-urls", paths],
    queryFn: () => signedPhotoUrls(paths),
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
  });
}

export function PhotoThumb({ paths, alt }: { paths: string[]; alt: string }) {
  const { data } = usePhotoUrls(paths.slice(0, 1));
  const url = data?.[0];

  if (!url) {
    return (
      <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <ImageOff className="size-5" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="size-20 shrink-0 rounded-xl object-cover"
    />
  );
}

export function PhotoGallery({ paths, alt }: { paths: string[]; alt: string }) {
  const { data, isLoading } = usePhotoUrls(paths);

  if (!paths.length) {
    return (
      <div className="flex h-44 items-center justify-center rounded-2xl bg-secondary text-sm text-muted-foreground">
        عکسی ثبت نشده است
      </div>
    );
  }

  if (isLoading) {
    return <div className="h-44 animate-pulse rounded-2xl bg-secondary" />;
  }

  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
      {(data ?? []).map((url, index) => (
        <img
          key={url}
          src={url}
          alt={`${alt} — تصویر ${index + 1}`}
          loading="lazy"
          className="h-44 w-72 shrink-0 snap-center rounded-2xl object-cover"
        />
      ))}
    </div>
  );
}
