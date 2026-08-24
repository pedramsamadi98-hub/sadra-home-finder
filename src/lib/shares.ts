import { supabase } from "@/integrations/supabase/client";

import type { ShareDuration } from "@/lib/shares.functions";

export interface PropertyShare {
  id: string;
  property_id: string;
  customer_id: string | null;
  created_by: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type ShareState = "active" | "expired" | "revoked";

export const SHARE_STATE_LABELS: Record<ShareState, string> = {
  active: "فعال",
  expired: "منقضی",
  revoked: "لغو شده",
};

export const SHARE_DURATION_LABELS: Record<ShareDuration, string> = {
  "1h": "۱ ساعت",
  "24h": "۲۴ ساعت",
  "3d": "۳ روز",
  "7d": "۷ روز",
  never: "بدون انقضا",
};

export function shareState(share: PropertyShare): ShareState {
  if (share.revoked_at) return "revoked";
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

export async function fetchPropertyShares(propertyId: string): Promise<PropertyShare[]> {
  const { data, error } = await supabase
    .from("property_shares")
    .select("id, property_id, customer_id, created_by, expires_at, revoked_at, created_at")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PropertyShare[];
}

export async function revokePropertyShare(id: string) {
  const { error } = await supabase
    .from("property_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
