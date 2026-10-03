import { Link } from "@tanstack/react-router";
import { BedDouble, Car, MapPin, MoveVertical, Package, Ruler } from "lucide-react";

import { PropertyTypeIcon } from "@/lib/property-type-icons";
import { useRole } from "@/lib/roles";

import { CoverThumb } from "@/components/PhotoGallery";
import { faArea, faDigits, faPrice, faRelative } from "@/lib/fa";
import {
  isLandType,
  needsPriceCheck,
  neighborhoodLabel,
  OWNERSHIP_LABELS,
  propertyTypeLabel,
  referencePrice,
  STATUS_LABELS,
  TRANSACTION_LABELS,
  type Property,
} from "@/lib/properties";


function statusClass(status: Property["status"]) {
  if (status === "active") return "bg-success/15 text-success";
  if (status === "sold") return "bg-destructive/15 text-destructive";
  if (status === "archived") return "bg-muted text-muted-foreground";
  return "bg-primary/15 text-primary";
}

export function PropertyCard({
  property,
  /** When the card is shown inside a broker's file list, keep that context. */
  brokerContext,
}: {
  property: Property;
  brokerContext?: string;
}) {
  const { isAdmin } = useRole();
  const priceText =
    property.transaction_type === "sale"
      ? faPrice(referencePrice(property))
      : `${faPrice(property.deposit)} رهن • ${faPrice(property.monthly_rent)} اجاره`;
  const priceCheck = property.transaction_type === "sale" && needsPriceCheck(property);

  const amenities = [
    property.parking ? { icon: Car, label: "پارکینگ" } : null,
    property.elevator ? { icon: MoveVertical, label: "آسانسور" } : null,
    property.storage ? { icon: Package, label: "انباری" } : null,
  ].filter(Boolean) as Array<{ icon: typeof Car; label: string }>;

  // Plot numbers belong to land listings only; a neighborhood is address text,
  // so the stored «زمین …» zone prefix is dropped here.
  const location = [
    property.city,
    property.phase,
    neighborhoodLabel(property.neighborhood),
    isLandType(property.property_type) && property.plot_number
      ? `پلاک ${faDigits(property.plot_number)}`
      : null,
  ]
    .filter(Boolean)
    .join(" — ");


  return (
    <Link
      to="/listings/$id"
      params={{ id: property.id }}
      {...(brokerContext ? { search: { broker: brokerContext } } : {})}
      className="surface-card block p-3 transition-transform active:scale-[0.99]"
    >
      <div className="flex gap-3">
        <CoverThumb property={property} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            {property.file_code !== null ? (
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                {faDigits(property.file_code)}
              </span>
            ) : null}
            <h3 className="min-w-0 flex-1 truncate text-sm font-bold">{property.title}</h3>
            {property.ownership_type ? (
              <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                {OWNERSHIP_LABELS[property.ownership_type]}
              </span>
            ) : null}
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(property.status)}`}
            >
              {STATUS_LABELS[property.status]}
            </span>
          </div>

          <p className="mt-1 text-sm font-semibold text-primary">
            <span className="text-[11px] font-medium text-muted-foreground">
              {TRANSACTION_LABELS[property.transaction_type]}
            </span>{" "}
            {priceText}
          </p>
          {priceCheck ? (
            <p className="mt-0.5 text-[11px] font-medium text-warning">
              نیازمند استعلام قیمت
            </p>
          ) : null}


          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
            <span className="flex items-center gap-1">
              <PropertyTypeIcon type={property.property_type} />
              {propertyTypeLabel(property.property_type)}
            </span>
          </div>

          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{location}</span>
          </p>

          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            {amenities.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1" title={label}>
                <Icon className="size-3.5" aria-hidden="true" />
                <span className="sr-only">{label}</span>
              </span>
            ))}
            {/* Only admins see how old a file is; collaborators must not skip a
                file just because it looks old. */}
            {isAdmin ? <span className="ms-auto">{faRelative(property.created_at)}</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
