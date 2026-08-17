import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  image: z.string().min(32), // data:image/...;base64,...
});

export interface OcrResult {
  title?: string | null;
  property_type?: "apartment" | "villa" | "land" | "commercial" | null;
  transaction_type?: "sale" | "rent" | "mortgage" | null;
  city?: string | null;
  phase?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  address?: string | null;
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

const SYSTEM_PROMPT = `تو یک دستیار استخراج اطلاعات فایل‌های ملکی فارسی هستی.
از تصویر (دست‌نویس یا تایپی) اطلاعات ملک را استخراج کن و فقط JSON برگردان.
قواعد:
- اعداد فارسی را به عدد لاتین تبدیل کن.
- مبالغ را به تومان و به صورت عدد کامل بنویس (مثال: «۶ میلیارد» => 6000000000، «۵۰ م» => 50000000).
- اگر مقداری در تصویر نیست یا با اطمینان خوانده نمی‌شود، آن فیلد را null بگذار. هرگز حدس نزن.
- property_type فقط یکی از: apartment, villa, land, commercial
- transaction_type فقط یکی از: sale (فروش), rent (اجاره), mortgage (رهن و اجاره)
- parking/elevator/storage مقدار boolean یا null.
- متن‌های فارسی را همان‌گونه که نوشته شده برگردان.`;

const JSON_SHAPE = `{"title":string|null,"property_type":string|null,"transaction_type":string|null,"city":string|null,"phase":string|null,"neighborhood":string|null,"street":string|null,"address":string|null,"area":number|null,"price":number|null,"deposit":number|null,"monthly_rent":number|null,"bedrooms":number|null,"floor":number|null,"total_floors":number|null,"building_age":number|null,"parking":boolean|null,"elevator":boolean|null,"storage":boolean|null,"owner_name":string|null,"owner_phone":string|null,"description":string|null,"notes":string|null}`;

const ALIASES: Record<string, keyof OcrResult> = {
  area_sqm: "area",
  area_m2: "area",
  size: "area",
  phone: "owner_phone",
  phone_number: "owner_phone",
  owner_phone_number: "owner_phone",
  owner: "owner_name",
  rent: "monthly_rent",
  rent_amount: "monthly_rent",
  mortgage: "deposit",
  mortgage_amount: "deposit",
  internal_notes: "notes",
  district: "neighborhood",
};

const NUMBER_KEYS = new Set([
  "area",
  "price",
  "deposit",
  "monthly_rent",
  "bedrooms",
  "floor",
  "total_floors",
  "building_age",
]);
const BOOL_KEYS = new Set(["parking", "elevator", "storage"]);

function normalize(raw: Record<string, unknown>): OcrResult {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(raw)) {
    const key = (ALIASES[rawKey] ?? rawKey) as string;
    if (value === null || value === undefined || value === "") continue;
    if (NUMBER_KEYS.has(key)) {
      const n = Number(String(value).replace(/[^\d.]/g, ""));
      if (Number.isFinite(n) && n > 0) out[key] = n;
    } else if (BOOL_KEYS.has(key)) {
      out[key] = value === true || value === "true" || value === "دارد";
    } else {
      out[key] = typeof value === "string" ? value.trim() : value;
    }
  }
  return out as OcrResult;
}

export const extractPropertyFromImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<OcrResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI key missing");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `اطلاعات این فایل ملکی را استخراج کن. فقط JSON با این ساختار: ${JSON_SHAPE}`,
              },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("OCR gateway error", response.status, body);
      throw new Error(`OCR failed: ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("OCR returned invalid JSON");
      parsed = JSON.parse(match[0]) as Record<string, unknown>;
    }
    return normalize(parsed);
  });
