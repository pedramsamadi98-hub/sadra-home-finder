import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


const inputSchema = z.object({
  image: z.string().min(32), // data:image/...;base64,...
});

/** One date/price pair read from the sheet — a price-history event. */
export interface OcrPriceEvent {
  /** Date as written on the sheet (usually Jalali, e.g. «۱۴۰۵/۰۶/۱۷»). */
  date?: string | null;
  price?: number | null;
  note?: string | null;
}

export interface OcrResult {
  /** «کد فایل» when the sheet shows one — used to match an existing file. */
  file_code?: number | null;
  /** Every date/price pair on the sheet, so no earlier price is lost. */
  price_events?: OcrPriceEvent[] | null;
  title?: string | null;
  property_type?: "apartment" | "villa" | "land" | "commercial" | null;
  transaction_type?: "sale" | "rent" | "mortgage" | null;
  city?: string | null;
  phase?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  address?: string | null;
  /** Raw land category/zone phrase read from the sheet (matched on the client). */
  land_text?: string | null;
  /** Canonical land category id (filled by client-side matching). */
  land_category?: string | null;
  /** Canonical land zone label (filled by client-side matching). */
  land_zone?: string | null;
  plot_number?: string | null;
  area?: number | null;
  price?: number | null;
  deposit?: number | null;
  monthly_rent?: number | null;
  bedrooms?: number | null;
  floor?: number | null;
  total_floors?: number | null;
  building_age?: number | null;
  parking?: boolean | null;
  elevator?: boolean | null;
  storage?: boolean | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  description?: string | null;
  notes?: string | null;
}

export const extractPropertyFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<OcrResult> => {
    // Same engine the bulk-import worker uses (src/lib/ocr.server.ts).
    const { extractFromImageDataUrl } = await import("@/lib/ocr.server");
    return extractFromImageDataUrl(data.image);
  });
