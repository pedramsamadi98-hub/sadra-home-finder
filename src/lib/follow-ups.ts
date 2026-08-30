import { supabase } from "@/integrations/supabase/client";

export type FollowUpStatus = "pending" | "done" | "canceled";
export type FollowUpPriority = "normal" | "important" | "urgent";
/** How the contact happened. */
export type FollowUpKind = "call" | "visit" | "message";

export interface FollowUp {
  id: string;
  user_id: string;
  property_id: string | null;
  customer_id: string | null;
  kind: FollowUpKind;
  called_at: string | null;
  call_result: string | null;
  next_at: string | null;
  notes: string | null;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type FollowUpInput = Pick<
  FollowUp,
  "kind" | "called_at" | "call_result" | "next_at" | "notes" | "status" | "priority"
>;

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  pending: "انجام نشده",
  done: "انجام شد",
  canceled: "لغو شد",
};

export const FOLLOW_UP_PRIORITY_LABELS: Record<FollowUpPriority, string> = {
  normal: "عادی",
  important: "مهم",
  urgent: "فوری",
};

export const FOLLOW_UP_KIND_LABELS: Record<FollowUpKind, string> = {
  call: "تماس",
  visit: "مراجعه",
  message: "پیام",
};

export function followUpKind(value: string | null | undefined): FollowUpKind {
  return value === "visit" || value === "message" ? value : "call";
}

export const emptyFollowUp: FollowUpInput = {
  kind: "call",
  called_at: null,
  call_result: "",
  next_at: null,
  notes: "",
  status: "pending",
  priority: "normal",
};


/** A follow-up hangs off a property file or off a customer. */
export interface FollowUpTarget {
  propertyId?: string | null;
  customerId?: string | null;
}

export async function fetchFollowUps(target?: FollowUpTarget): Promise<FollowUp[]> {
  let query = supabase
    .from("follow_ups")
    .select("*")
    .order("created_at", { ascending: false });
  if (target?.propertyId) query = query.eq("property_id", target.propertyId);
  if (target?.customerId) query = query.eq("customer_id", target.customerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as FollowUp[];
}

export async function createFollowUp(
  target: FollowUpTarget,
  input: FollowUpInput,
  userId: string,
) {
  const { error } = await supabase.from("follow_ups").insert({
    ...input,
    property_id: target.propertyId ?? null,
    customer_id: target.customerId ?? null,
    user_id: userId,
  });
  if (error) throw error;
}

export async function completeFollowUp(id: string) {
  const { error } = await supabase
    .from("follow_ups")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setFollowUpStatus(id: string, status: FollowUpStatus) {
  const { error } = await supabase
    .from("follow_ups")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFollowUp(id: string) {
  const { error } = await supabase.from("follow_ups").delete().eq("id", id);
  if (error) throw error;
}

/** Buckets for the dashboard: overdue / today / tomorrow. */
export type DueBucket = "overdue" | "today" | "tomorrow" | "later";

export function dueBucket(followUp: FollowUp, now = new Date()): DueBucket | null {
  if (!followUp.next_at || followUp.status !== "pending") return null;
  const next = new Date(followUp.next_at);
  if (Number.isNaN(next.getTime())) return null;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfDayAfter = new Date(startOfTomorrow);
  startOfDayAfter.setDate(startOfDayAfter.getDate() + 1);

  if (next < startOfToday) return "overdue";
  if (next < startOfTomorrow) return next < now ? "overdue" : "today";
  if (next < startOfDayAfter) return "tomorrow";
  return "later";
}

export type FollowUpSort = "priority" | "soonest" | "oldest";

const PRIORITY_WEIGHT: Record<FollowUpPriority, number> = {
  urgent: 0,
  important: 1,
  normal: 2,
};

export function sortFollowUps(items: FollowUp[], sort: FollowUpSort): FollowUp[] {
  const copy = [...items];
  if (sort === "priority") {
    copy.sort(
      (a, b) =>
        PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] ||
        new Date(a.next_at ?? 0).getTime() - new Date(b.next_at ?? 0).getTime(),
    );
  } else if (sort === "soonest") {
    copy.sort(
      (a, b) => new Date(a.next_at ?? 0).getTime() - new Date(b.next_at ?? 0).getTime(),
    );
  } else {
    copy.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }
  return copy;
}

/** ISO -> value for <input type="datetime-local"> in local time. */
export function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Latest logged contact + next pending follow-up for a set of records. */
export function followUpSummary(items: FollowUp[]): {
  last: FollowUp | null;
  next: FollowUp | null;
} {
  const byRecent = [...items].sort(
    (a, b) =>
      new Date(b.called_at ?? b.created_at).getTime() -
      new Date(a.called_at ?? a.created_at).getTime(),
  );
  const pending = items
    .filter((item) => item.status === "pending" && item.next_at)
    .sort((a, b) => new Date(a.next_at ?? 0).getTime() - new Date(b.next_at ?? 0).getTime());
  return { last: byRecent[0] ?? null, next: pending[0] ?? null };
}
