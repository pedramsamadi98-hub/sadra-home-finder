import { supabase } from "@/integrations/supabase/client";

export interface Broker {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  agency: string | null;
  notes: string | null;
  /** Last time this broker's prices / files were refreshed. */
  last_contact_at: string | null;
  last_contact_note: string | null;
  /** How often this broker should be contacted, in days. */
  update_interval_days: number;
  created_at: string;
  updated_at: string;
}

export type BrokerInput = Pick<
  Broker,
  "name" | "phone" | "agency" | "notes" | "update_interval_days"
>;

export const emptyBroker: BrokerInput = {
  name: "",
  phone: "",
  agency: "",
  notes: "",
  update_interval_days: 14,
};

/* --------------------------- follow-up freshness -------------------------- */

export const DEFAULT_UPDATE_INTERVAL = 14;

export type BrokerFreshness = "fresh" | "due" | "overdue" | "never";

export const FRESHNESS_LABELS: Record<BrokerFreshness, string> = {
  fresh: "بروز",
  due: "زمان بروزرسانی",
  overdue: "عقب‌افتاده",
  never: "بدون سابقه تماس",
};

export const FRESHNESS_TONE: Record<BrokerFreshness, string> = {
  fresh: "bg-success/15 text-success",
  due: "bg-warning/15 text-warning",
  overdue: "bg-destructive/15 text-destructive",
  never: "bg-muted text-muted-foreground",
};

/** Whole days since the broker's information was last refreshed. */
export function daysSinceUpdate(broker: Broker): number | null {
  if (!broker.last_contact_at) return null;
  const time = new Date(broker.last_contact_at).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

export function brokerFreshness(broker: Broker): BrokerFreshness {
  const days = daysSinceUpdate(broker);
  if (days === null) return "never";
  const interval = broker.update_interval_days || DEFAULT_UPDATE_INTERVAL;
  if (days >= interval * 2) return "overdue";
  if (days >= interval) return "due";
  return "fresh";
}

/** Brokers that must be called again so no broker is ever forgotten. */
export function needsUpdate(broker: Broker): boolean {
  return brokerFreshness(broker) !== "fresh";
}

/** Sort helper: the most neglected broker first. */
export function staleFirst(a: Broker, b: Broker): number {
  const rank: Record<BrokerFreshness, number> = { never: 0, overdue: 1, due: 2, fresh: 3 };
  const diff = rank[brokerFreshness(a)] - rank[brokerFreshness(b)];
  if (diff !== 0) return diff;
  return (daysSinceUpdate(b) ?? 0) - (daysSinceUpdate(a) ?? 0);
}

export async function fetchBrokers(): Promise<Broker[]> {
  const { data, error } = await supabase
    .from("brokers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Broker[];
}

export async function createBroker(input: BrokerInput, userId: string) {
  const { error } = await supabase.from("brokers").insert({ ...input, user_id: userId });
  if (error) throw error;
}

export async function updateBroker(id: string, input: BrokerInput) {
  const { error } = await supabase.from("brokers").update(input).eq("id", id);
  if (error) throw error;
}

/** Records "I just refreshed this broker's prices / files" (now). */
export async function touchBroker(id: string, note?: string | null) {
  const { error } = await supabase
    .from("brokers")
    .update({
      last_contact_at: new Date().toISOString(),
      last_contact_note: note?.trim() || null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBroker(id: string) {
  const { error } = await supabase.from("brokers").delete().eq("id", id);
  if (error) throw error;
}
