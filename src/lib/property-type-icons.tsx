import {
  Briefcase,
  Building,
  Building2,
  CalendarClock,
  Fence,
  Grid2x2,
  Hotel,
  House,
  LandPlot,
  Layers,
  Map,
  Sprout,
  Store,
  Ticket,
  Trees,
  type LucideIcon,
} from "lucide-react";

import type { PropertyType } from "@/lib/properties";

/**
 * One consistent icon per usage type (نوع کاربری). Used identically in the
 * form chips, property card, detail rows and dashboard — never emojis.
 */
export const PROPERTY_TYPE_ICONS: Record<PropertyType, LucideIcon> = {
  complex: Building2,
  single_block: Building,
  tabaq_villaei: Layers,
  villa_package: House,
  villa_darbast: Fence,
  land_phase_1: LandPlot,
  land_phase_2: LandPlot,
  apartment_land_phase_1: Grid2x2,
  apartment_land_phase_2: Grid2x2,
  baghshahri: Trees,
  zamin_baghshahri: Sprout,
  // Legacy values kept for existing rows.
  apartment: Building,
  villa: House,
  land: Map,
  commercial: Store,
};

export function propertyTypeIcon(type: string | null | undefined): LucideIcon {
  return PROPERTY_TYPE_ICONS[type as PropertyType] ?? Building;
}

export function PropertyTypeIcon({
  type,
  className = "size-3.5",
}: {
  type: string | null | undefined;
  className?: string;
}) {
  const Icon = propertyTypeIcon(type);
  return <Icon className={className} />;
}
