import { Link } from "@tanstack/react-router";
import { BedDouble, Building, MapPin, Ruler } from "lucide-react";

import { PhotoThumb } from "@/components/PhotoGallery";
import { faArea, faDigits, faPrice, faRelative } from "@/lib/fa";
import {
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  TRANSACTION_LABELS,
  type Property,
} from "@/lib/properties";

function statusClass(status: Property["status"]) {
  if (status === "active") return "bg-success/15 text-success";
  if (status === "sold") return "bg-destructive/15 text-destructive";
  return "bg-primary/15 text-primary";
}

export function PropertyCard({ property }: { property: Property }) {
  const priceText =
    property.transaction_type === "rent"
      ? `${faPrice(property.deposit)} رهن • ${faPrice(property.monthly_rent)} اجاره`
      : faPrice(property.price);

  return (
    <Link
      to="/listings/$id"
      params={{ id: property.id }}
      className="surface-card block p-3 transition-transform active:scale-[0.99]"
    >
      <div className="flex gap-3">
        <PhotoThumb paths={property.photos} alt={property.title} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-bold">{property.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(property.status)}`}
            >
              {STATUS_LABELS[property.status]}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            <span className="truncate">
              {property.city}
              {property.neighborhood ? ` — ${property.neighborhood}` : ""}
            </span>
          </p>
          <p className="mt-1.5 text-sm font-semibold text-primary">{priceText}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building className="size-3.5" />
              {PROPERTY_TYPE_LABELS[property.property_type]} •{" "}
              {TRANSACTION_LABELS[property.transaction_type]}
            </span>
            <span className="flex items-center gap-1">
              <Ruler className="size-3.5" />
              {faArea(property.area)}
            </span>
            {property.bedrooms ? (
              <span className="flex items-center gap-1">
                <BedDouble className="size-3.5" />
                {faDigits(property.bedrooms)} خواب
              </span>
            ) : null}
            <span>{faRelative(property.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
