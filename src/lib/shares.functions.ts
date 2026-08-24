import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";

export type ShareDuration = "1h" | "24h" | "3d" | "7d" | "never";

const DURATION_MS: Record<Exclude<ShareDuration, "never">, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

/** Public payload of a shared file — never contains owner, broker or private data. */
export interface SharedPropertyView {
  title: string;
  property_type: string;
  transaction_type: string;
  ownership_type: string | null;
  status: string;
  city: string;
  phase: string | null;
  neighborhood: string | null;
  area: number | null;
  price: number | null;
  deposit: number | null;
  monthly_rent: number | null;
  bedrooms: number | null;
  building_age: number | null;
  parking: boolean;
  elevator: boolean;
  storage: boolean;
  description: string | null;
  photos: string[];
}

export type SharedPropertyResult =
  | { state: "ok"; property: SharedPropertyView }
  | { state: "invalid" | "expired" | "revoked" };

/** Creates a share link. Raw token is returned once, only the hash is stored. */
export const createPropertyShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { propertyId: string; duration: ShareDuration; customerId?: string | null }) => {
    const propertyId = String(data?.propertyId ?? "");
    if (!/^[0-9a-fA-F-]{36}$/.test(propertyId)) throw new Error("شناسه ملک معتبر نیست");
    const duration = (["1h", "24h", "3d", "7d", "never"] as const).includes(
      data?.duration as ShareDuration,
    )
      ? (data.duration as ShareDuration)
      : "24h";
    const customerId =
      data?.customerId && /^[0-9a-fA-F-]{36}$/.test(String(data.customerId))
        ? String(data.customerId)
        : null;
    return { propertyId, duration, customerId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);

    // Confirm the admin can actually see this file under RLS.
    const { data: property, error: propError } = await context.supabase
      .from("properties")
      .select("id")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (propError) throw new Error(propError.message);
    if (!property) throw new Error("ملک پیدا نشد");

    const { generateShareToken, hashShareToken } = await import("@/lib/shares.server");
    const token = generateShareToken();
    const tokenHash = await hashShareToken(token);
    const expiresAt =
      data.duration === "never"
        ? null
        : new Date(Date.now() + DURATION_MS[data.duration]).toISOString();

    const { data: inserted, error } = await context.supabase
      .from("property_shares")
      .insert({
        property_id: data.propertyId,
        customer_id: data.customerId,
        created_by: context.userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: inserted.id as string, token, expiresAt };
  });

/** Public reader: resolves a share token to public-only property data. */
export const getSharedProperty = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    const token = String(data?.token ?? "").trim().toLowerCase();
    return { token };
  })
  .handler(async ({ data }): Promise<SharedPropertyResult> => {
    if (!/^[0-9a-f]{64}$/.test(data.token)) return { state: "invalid" };

    const { hashShareToken } = await import("@/lib/shares.server");
    const tokenHash = await hashShareToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: share } = await supabaseAdmin
      .from("property_shares")
      .select("property_id, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!share) return { state: "invalid" };
    if (share.revoked_at) return { state: "revoked" };
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now())
      return { state: "expired" };

    const { data: row } = await supabaseAdmin
      .from("properties")
      .select(
        "title, property_type, transaction_type, ownership_type, status, city, phase, neighborhood, area, price, deposit, monthly_rent, bedrooms, building_age, parking, elevator, storage, description, photos, private_photos",
      )
      .eq("id", share.property_id)
      .maybeSingle();
    if (!row) return { state: "invalid" };

    const { photos, private_photos, ...publicFields } = row as typeof row & {
      photos: string[];
      private_photos: string[];
    };

    // Only images explicitly classified as public listing photos, never private OCR ones.
    const candidates = (photos ?? []).filter((p) => !(private_photos ?? []).includes(p));
    let allowed: string[] = [];
    if (candidates.length) {
      const { data: visibility } = await supabaseAdmin
        .from("photo_visibility")
        .select("storage_path, visibility")
        .in("storage_path", candidates)
        .eq("visibility", "public_listing");
      allowed = (visibility ?? []).map((v) => v.storage_path as string);
    }

    let signed: string[] = [];
    if (allowed.length) {
      const { data: urls } = await supabaseAdmin.storage
        .from("property-photos")
        .createSignedUrls(allowed, 60 * 60);
      signed = (urls ?? [])
        .map((item) => item.signedUrl)
        .filter((url): url is string => Boolean(url));
    }

    return {
      state: "ok",
      property: { ...(publicFields as Omit<SharedPropertyView, "photos">), photos: signed },
    };
  });
