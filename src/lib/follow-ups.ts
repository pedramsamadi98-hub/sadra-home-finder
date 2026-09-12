import { supabase } from "@/integrations/supabase/client";

export type FollowUpStatus = "pending" | "done" | "canceled";
export type FollowUpPriority = "normal" | "important" | "urgent";
/**
 * What the reminder is about. `call` / `visit` / `message` keep the original
 * customer & file follow-up meaning; `task` is a personal to-do.
 */
export type FollowUpKind = "call" | "visit" | "message" | "task";

export interface FollowUp {
  id: string;
  user_id: string;
  property_id: string | null;
  customer_id: string | null;
  /** Optional link to a broker — reminders can hang off any of the three. */
  broker_id: string | null;
  /** Free-text subject, required for reminders that have no linked record. */
  title: string | null;
  /** True when only the date matters (no meaningful time of day). */
  all_day: boolean;
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
  | "kind"
  | "title"
  | "all_day"
  | "called_at"
  | "call_result"
  | "next_at"
  | "notes"
  | "status"
  | "priority"
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
  task: "کار شخصی",
};

export function followUpKind(value: string | null | undefined): FollowUpKind {
  return value === "visit" || value === "message" || value === "task" ? value : "call";
}

export const emptyFollowUp: FollowUpInput = {
  kind: "call",
  title: "",
  all_day: false,
  called_at: null,
  call_result: "",
  next_at: null,
  notes: "",
  status: "pending",
  priority: "normal",
};

/** A blank general reminder: a dated personal task with a title. */
export const emptyReminder: FollowUpInput = {
  ...emptyFollowUp,
  kind: "task",
  all_day: true,
};

/** A reminder can hang off a property file, a customer, a broker, or nothing. */
export interface FollowUpTarget {
  propertyId?: string | null;
  customerId?: string | null;
  brokerId?: string | null;
}

export async function fetchFollowUps(target?: FollowUpTarget): Promise<FollowUp[]> {
  let query = supabase
    .from("follow_ups")
    .select("*")
    .order("created_at", { ascending: false });
  if (target?.propertyId) query = query.eq("property_id", target.propertyId);
  if (target?.customerId) query = query.eq("customer_id", target.customerId);
  if (target?.brokerId) query = query.eq("broker_id", target.brokerId);
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
    title: input.title?.trim() || null,
    property_id: target.propertyId ?? null,
    customer_id: target.customerId ?? null,
    broker_id: target.brokerId ?? null,
    user_id: userId,
  });
  if (error) throw error;
}

/** Edits an existing reminder, including which record it points at. */
export async function updateFollowUp(
  id: string,
  input: FollowUpInput,
  target?: FollowUpTarget,
) {
  const { error } = await supabase
    .from("follow_ups")
    .update({
      ...input,
      title: input.title?.trim() || null,
      ...(target
        ? {
            property_id: target.propertyId ?? null,
            customer_id: target.customerId ?? null,
            broker_id: target.brokerId ?? null,
          }
        : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Display subject for any reminder, whatever it is linked to. */
export function reminderSubject(item: FollowUp): string {
  return (
    item.title?.trim() ||
    item.call_result?.trim() ||
    item.notes?.trim() ||
    FOLLOW_UP_KIND_LABELS[followUpKind(item.kind)]
  );
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
