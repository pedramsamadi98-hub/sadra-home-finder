import { supabase } from "@/integrations/supabase/client";
import { enDigits } from "@/lib/fa";
import type { Property, TransactionType } from "@/lib/properties";

/* ---------------------------------- types --------------------------------- */

export type CustomerStatus = "active" | "inactive" | "closed" | "lost";

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "فعال",
  inactive: "غیرفعال",
  closed: "معامله انجام شد",
  lost: "منصرف شد",
};

export const CUSTOMER_STATUS_TONE: Record<CustomerStatus, string> = {
  active: "bg-primary/15 text-primary",
  inactive: "bg-muted text-muted-foreground",
  closed: "bg-success/15 text-success",
  lost: "bg-destructive/15 text-destructive",
};

export interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  notes: string | null;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
}

export type CustomerInput = Pick<Customer, "full_name" | "phone" | "notes" | "status">;

export const emptyCustomer: CustomerInput = {
  full_name: "",
  phone: "",
  notes: "",
  status: "active",
};

/** What the customer is looking for. */
export type ReqTransactionType = "sale" | "rent" | "mortgage" | "mortgage_rent";

export const REQ_TRANSACTION_LABELS: Record<ReqTransactionType, string> = {
  sale: "خرید",
  rent: "اجاره",
  mortgage: "رهن",
  mortgage_rent: "رهن و اجاره",
};

/** Which property transaction types satisfy a customer's requested deal. */
const TRANSACTION_MATCH: Record<ReqTransactionType, TransactionType[]> = {
  sale: ["sale"],
  rent: ["rent", "mortgage"],
  mortgage: ["mortgage", "rent"],
  mortgage_rent: ["mortgage", "rent"],
};

export type ReqOwnershipType = "melki" | "owqaf" | "any";

export const REQ_OWNERSHIP_LABELS: Record<ReqOwnershipType, string> = {
  melki: "ملکی",
  owqaf: "اوقاف",
  any: "فرقی ندارد",
};

export interface CustomerRequirement {
  id: string;
  customer_id: string;
  user_id: string;
  transaction_type: ReqTransactionType;
  ownership_type: ReqOwnershipType;
  city: string | null;
  phase: string | null;
  neighborhood: string | null;
  min_area: number | null;
  max_area: number | null;
  bedrooms: number | null;
  min_budget: number | null;
  max_budget: number | null;
  needs_parking: boolean;
  needs_elevator: boolean;
  needs_storage: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type RequirementInput = Omit<
  CustomerRequirement,
  "id" | "customer_id" | "user_id" | "created_at" | "updated_at"
>;

export const emptyRequirement: RequirementInput = {
  transaction_type: "sale",
  ownership_type: "any",
  city: "صدرا",
  phase: "",
  neighborhood: "",
  min_area: null,
  max_area: null,
  bedrooms: null,
  min_budget: null,
  max_budget: null,
  needs_parking: false,
  needs_elevator: false,
  needs_storage: false,
  description: "",
};

/* ------------------------------- customers -------------------------------- */

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Customer[];
}

export async function fetchCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Customer) ?? null;
}

export async function createCustomer(input: CustomerInput, userId: string) {
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...normalizeCustomer(input), user_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const { error } = await supabase
    .from("customers")
    .update(normalizeCustomer(input))
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}

function normalizeCustomer(input: CustomerInput) {
  return {
    full_name: input.full_name.trim(),
    phone: input.phone ? enDigits(input.phone).trim() : null,
    notes: input.notes?.trim() || null,
    status: input.status,
  };
}

/* ------------------------------ requirements ------------------------------ */

export async function fetchRequirements(customerId?: string): Promise<CustomerRequirement[]> {
  let query = supabase
    .from("customer_requirements")
    .select("*")
    .order("created_at", { ascending: true });
  if (customerId) query = query.eq("customer_id", customerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as CustomerRequirement[];
}

function normalizeRequirement(input: RequirementInput) {
  return {
    transaction_type: input.transaction_type,
    ownership_type: input.ownership_type,
    city: input.city?.trim() || null,
    phase: input.phase?.trim() || null,
    neighborhood: input.neighborhood?.trim() || null,
    min_area: input.min_area,
    max_area: input.max_area,
    bedrooms: input.bedrooms,
    min_budget: input.min_budget,
    max_budget: input.max_budget,
    needs_parking: input.needs_parking,
    needs_elevator: input.needs_elevator,
    needs_storage: input.needs_storage,
    description: input.description?.trim() || null,
  };
}

export async function createRequirement(
  customerId: string,
  input: RequirementInput,
  userId: string,
) {
  const { error } = await supabase.from("customer_requirements").insert({
    ...normalizeRequirement(input),
    customer_id: customerId,
    user_id: userId,
  });
  if (error) throw error;
}

export async function updateRequirement(id: string, input: RequirementInput) {
  const { error } = await supabase
    .from("customer_requirements")
    .update(normalizeRequirement(input))
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRequirement(id: string) {
  const { error } = await supabase.from("customer_requirements").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------- searching ------------------------------- */

export function customerMatchesQuery(
  customer: Customer,
  requirements: CustomerRequirement[],
  rawQuery: string,
): boolean {
  const query = enDigits(rawQuery).trim().toLowerCase();
  if (!query) return true;
  const parts: string[] = [
    customer.full_name,
    customer.phone ?? "",
    customer.notes ?? "",
    CUSTOMER_STATUS_LABELS[customer.status],
  ];
  for (const req of requirements) {
    parts.push(
      REQ_TRANSACTION_LABELS[req.transaction_type],
      REQ_OWNERSHIP_LABELS[req.ownership_type],
      req.city ?? "",
      req.phase ?? "",
      req.neighborhood ?? "",
      req.description ?? "",
    );
  }
  const haystack = enDigits(parts.filter(Boolean).join(" ")).toLowerCase();
  return query.split(/\s+/).every((token) => haystack.includes(token));
}

/* -------------------------------- matching -------------------------------- */

export interface MatchCheck {
  label: string;
  state: "ok" | "fail" | "neutral";
  detail?: string;
}

export interface MatchResult {
  score: number;
  checks: MatchCheck[];
  /** Hard incompatibility: deal type or ownership type is wrong. */
  blocked: boolean;
}

function effectivePrice(property: Property, req: CustomerRequirement): number | null {
  if (req.transaction_type === "sale") return property.price;
  return property.deposit ?? property.price;
}

function textMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const x = enDigits(a).trim().toLowerCase();
  const y = enDigits(b).trim().toLowerCase();
  return x.includes(y) || y.includes(x);
}

/**
 * Scores a property against a single customer requirement.
 * "مهم نیست" (needs_* = false, empty ranges) never removes a candidate.
 */
export function matchProperty(property: Property, req: CustomerRequirement): MatchResult {
  const checks: MatchCheck[] = [];
  let blocked = false;

  // Deal type — hard filter
  const dealOk = TRANSACTION_MATCH[req.transaction_type].includes(property.transaction_type);
  checks.push({
    label: `نوع معامله (${REQ_TRANSACTION_LABELS[req.transaction_type]})`,
    state: dealOk ? "ok" : "fail",
  });
  if (!dealOk) blocked = true;

  // Ownership type — hard filter unless "فرقی ندارد"
  if (req.ownership_type === "any") {
    checks.push({ label: "نوع ملک (فرقی ندارد)", state: "neutral" });
  } else {
    const ownOk = property.ownership_type === req.ownership_type;
    checks.push({
      label: `نوع ملک (${REQ_OWNERSHIP_LABELS[req.ownership_type]})`,
      state: ownOk ? "ok" : "fail",
    });
    if (!ownOk) blocked = true;
  }

  // City
  if (req.city) {
    checks.push({
      label: `شهر (${req.city})`,
      state: textMatch(property.city, req.city) ? "ok" : "fail",
    });
  } else {
    checks.push({ label: "شهر (مهم نیست)", state: "neutral" });
  }

  // Phase / neighborhood
  if (req.phase || req.neighborhood) {
    const ok =
      (req.phase ? textMatch(property.phase, req.phase) : false) ||
      (req.neighborhood
        ? textMatch(property.neighborhood, req.neighborhood) ||
          textMatch(property.phase, req.neighborhood)
        : false);
    checks.push({
      label: `فاز / محله (${[req.phase, req.neighborhood].filter(Boolean).join(" / ")})`,
      state: ok ? "ok" : "fail",
    });
  } else {
    checks.push({ label: "فاز / محله (مهم نیست)", state: "neutral" });
  }

  // Area
  if (req.min_area !== null || req.max_area !== null) {
    const area = property.area;
    const ok =
      area !== null &&
      (req.min_area === null || area >= req.min_area) &&
      (req.max_area === null || area <= req.max_area);
    checks.push({ label: "متراژ مناسب", state: ok ? "ok" : "fail" });
  } else {
    checks.push({ label: "متراژ (مهم نیست)", state: "neutral" });
  }

  // Bedrooms
  if (req.bedrooms !== null) {
    const ok = property.bedrooms !== null && property.bedrooms >= req.bedrooms;
    checks.push({ label: "تعداد خواب مناسب", state: ok ? "ok" : "fail" });
  } else {
    checks.push({ label: "تعداد خواب (مهم نیست)", state: "neutral" });
  }

  // Budget
  if (req.min_budget !== null || req.max_budget !== null) {
    const price = effectivePrice(property, req);
    const ok =
      price !== null &&
      price > 0 &&
      (req.min_budget === null || price >= req.min_budget) &&
      (req.max_budget === null || price <= req.max_budget);
    checks.push({ label: "بودجه مناسب", state: ok ? "ok" : "fail" });
  } else {
    checks.push({ label: "بودجه (مهم نیست)", state: "neutral" });
  }

  // Facilities
  const facilities: [boolean, boolean, string][] = [
    [req.needs_parking, property.parking, "پارکینگ"],
    [req.needs_elevator, property.elevator, "آسانسور"],
    [req.needs_storage, property.storage, "انباری"],
  ];
  for (const [needed, has, label] of facilities) {
    if (!needed) {
      checks.push({ label: `${label} (مهم نیست)`, state: "neutral" });
    } else {
      checks.push({ label: `${label} موردنیاز موجود است`, state: has ? "ok" : "fail" });
    }
  }

  const graded = checks.filter((c) => c.state !== "neutral");
  const passed = graded.filter((c) => c.state === "ok").length;
  const score = graded.length ? Math.round((passed / graded.length) * 100) : 100;

  return { score, checks, blocked };
}

/** Best requirement match for a property (a customer can have many needs). */
export function bestMatch(
  property: Property,
  requirements: CustomerRequirement[],
): { requirement: CustomerRequirement; result: MatchResult } | null {
  let best: { requirement: CustomerRequirement; result: MatchResult } | null = null;
  for (const requirement of requirements) {
    const result = matchProperty(property, requirement);
    if (result.blocked) continue;
    if (!best || result.score > best.result.score) best = { requirement, result };
  }
  return best;
}

export const MATCH_THRESHOLD = 60;
