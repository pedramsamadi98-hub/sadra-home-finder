import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BellRing,
  Building2,
  Check,
  ChevronLeft,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminOnly } from "@/components/AdminOnly";
import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FollowUpKindBadge, PRIORITY_TONE } from "@/components/FollowUpSection";
import { EmptyState } from "@/components/StateBlocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchBrokers } from "@/lib/brokers";
import { fetchCustomers } from "@/lib/customers";
import { faDate, faDateTime, faDigits } from "@/lib/fa";
import {
  createFollowUp,
  deleteFollowUp,
  emptyReminder,
  fetchFollowUps,
  FOLLOW_UP_KIND_LABELS,
  FOLLOW_UP_PRIORITY_LABELS,
  followUpKind,
  reminderSubject,
  setFollowUpStatus,
  updateFollowUp,
  type FollowUp,
  type FollowUpInput,
  type FollowUpKind,
  type FollowUpPriority,
} from "@/lib/follow-ups";
import { fetchProperties } from "@/lib/properties";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "یادآورها | املاک صدرا" },
      {
        name: "description",
        content:
          "یادآورهای کاری صدرا ملک: پیگیری مشتری، فایل، دلال، تماس و کارهای شخصی در یک لیست یکپارچه.",
      },
      { property: "og:title", content: "یادآورها" },
      {
        property: "og:description",
        content: "کارهای امروز، عقب‌افتاده و آینده در یک سیستم یادآوری یکپارچه.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RemindersRoute,
});

function RemindersRoute() {
  return <AdminOnly>{(userId) => <Reminders userId={userId} />}</AdminOnly>;
}

/** Splits an ISO timestamp into the date / time pieces the inputs use. */
function splitIso(value: string | null): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}

function joinIso(date: string, time: string): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T${time || "09:00"}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

type Bucket = "overdue" | "today" | "upcoming" | "doneToday";

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: "عقب‌افتاده",
  today: "امروز",
  upcoming: "آینده",
  doneToday: "انجام‌شده امروز",
};

const BUCKET_TONE: Record<Bucket, string> = {
  overdue: "bg-destructive/15 text-destructive",
  today: "bg-primary/15 text-primary",
  upcoming: "bg-secondary text-muted-foreground",
  doneToday: "bg-success/15 text-success",
};

function bucketOf(item: FollowUp, now: Date): Bucket | null {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (item.status === "done") {
    if (!item.completed_at) return null;
    const done = new Date(item.completed_at);
    return done >= startOfToday && done < startOfTomorrow ? "doneToday" : null;
  }
  if (item.status !== "pending") return null;
  if (!item.next_at) return null;
  const next = new Date(item.next_at);
  if (Number.isNaN(next.getTime())) return null;
  if (next < startOfToday) return "overdue";
  if (next < startOfTomorrow) return next < now ? "overdue" : "today";
  return "upcoming";
}

function Reminders({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FollowUpInput>(emptyReminder);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [brokerId, setBrokerId] = useState("");
  

  const { data: items, isLoading } = useQuery({
    queryKey: ["follow_ups"],
    queryFn: () => fetchFollowUps(),
  });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
  const { data: brokers } = useQuery({ queryKey: ["brokers"], queryFn: fetchBrokers });
  const { data: properties } = useQuery({
    queryKey: ["properties"],
    queryFn: fetchProperties,
  });

  const customerName = (id: string | null) =>
    customers?.find((item) => item.id === id)?.full_name ?? null;
  const customerPhone = (id: string | null) =>
    customers?.find((item) => item.id === id)?.phone ?? null;
  const brokerName = (id: string | null) =>
    brokers?.find((item) => item.id === id)?.name ?? null;
  const propertyTitle = (id: string | null) =>
    properties?.find((item) => item.id === id)?.title ?? null;

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["follow_ups"] });
  }

  function reset() {
    setForm(emptyReminder);
    setDate("");
    setTime("");
    setCustomerId("");
    setPropertyId("");
    setBrokerId("");
    setEditingId(null);
    setOpen(false);
  }

  function startEdit(item: FollowUp) {
    const parts = splitIso(item.next_at);
    setForm({
      kind: followUpKind(item.kind),
      title: item.title ?? "",
      all_day: item.all_day,
      called_at: item.called_at,
      call_result: item.call_result ?? "",
      next_at: item.next_at,
      notes: item.notes ?? "",
      status: item.status,
      priority: item.priority,
    });
    setDate(parts.date);
    setTime(item.all_day ? "" : parts.time);
    setCustomerId(item.customer_id ?? "");
    setPropertyId(item.property_id ?? "");
    setBrokerId(item.broker_id ?? "");
    setEditingId(item.id);
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: FollowUpInput = {
        ...form,
        all_day: !time,
        next_at: joinIso(date, time),
      };
      const target = {
        customerId: customerId || null,
        propertyId: propertyId || null,
        brokerId: brokerId || null,
      };
      if (editingId) await updateFollowUp(editingId, payload, target);
      else await createFollowUp(target, payload, userId);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(editingId ? "یادآور ویرایش شد" : "یادآور ثبت شد");
      reset();
    },
    onError: () => toast.error("ثبت یادآور ناموفق بود"),
  });

  const complete = useMutation({
    mutationFn: (id: string) => setFollowUpStatus(id, "done"),
    onSuccess: async () => {
      await invalidate();
      toast.success("یادآور انجام شد");
    },
    onError: () => toast.error("ثبت انجام‌شدن ناموفق بود"),
  });

  const reopen = useMutation({
    mutationFn: (id: string) => setFollowUpStatus(id, "pending"),
    onSuccess: async () => {
      await invalidate();
      toast.success("یادآور باز شد");
    },
    onError: () => toast.error("تغییر وضعیت ناموفق بود"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFollowUp(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("یادآور حذف شد");
    },
    onError: () => toast.error("حذف ناموفق بود"),
  });

  const groups = useMemo(() => {
    const now = new Date();
    const result: Record<Bucket, FollowUp[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      doneToday: [],
    };
    for (const item of items ?? []) {
      const bucket = bucketOf(item, now);
      if (bucket) result[bucket].push(item);
    }
    const byDate = (a: FollowUp, b: FollowUp) =>
      new Date(a.next_at ?? 0).getTime() - new Date(b.next_at ?? 0).getTime();
    result.overdue.sort(byDate);
    result.today.sort(byDate);
    result.upcoming.sort(byDate);
    return result;
  }, [items]);

  const canSave = Boolean(
    (form.title ?? "").trim() || customerId || propertyId || brokerId,
  );

  return (
    <AppShell
      title="یادآورها"
      subtitle="پیگیری مشتری، فایل، دلال و کارهای شخصی"
      brand={{ title: "صدرا ملک" }}
      action={
        <button
          type="button"
          onClick={() => (open ? reset() : setOpen(true))}
          aria-label={open ? "بستن فرم" : "یادآور جدید"}
          className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary"
        >
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
        </button>
      }
    >
      <div className="space-y-4">
        {open ? (
          <section className="surface-card space-y-3 p-4">
            <h2 className="text-sm font-bold">
              {editingId ? "ویرایش یادآور" : "یادآور جدید"}
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="reminder-title" className="text-xs">
                عنوان / موضوع
              </Label>
              <Input
                id="reminder-title"
                className="h-11"
                placeholder="مثلاً: ۳ روز بعد پیگیری زمین مولانا ۴"
                value={form.title ?? ""}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="reminder-date" className="text-xs">
                  تاریخ
                </Label>
                <Input
                  id="reminder-date"
                  type="date"
                  dir="ltr"
                  className="h-11 text-left"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reminder-time" className="text-xs">
                  زمان (اختیاری)
                </Label>
                <Input
                  id="reminder-time"
                  type="time"
                  dir="ltr"
                  className="h-11 text-left"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">نوع</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FOLLOW_UP_KIND_LABELS) as FollowUpKind[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, kind: key }))}
                    className={`h-10 rounded-xl border px-3 text-xs font-medium transition-colors ${
                      form.kind === key
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {FOLLOW_UP_KIND_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">اولویت</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FOLLOW_UP_PRIORITY_LABELS) as FollowUpPriority[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, priority: key }))}
                    className={`h-10 rounded-xl border px-3 text-xs font-medium transition-colors ${
                      form.priority === key
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {FOLLOW_UP_PRIORITY_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reminder-customer" className="text-xs">
                مشتری (اختیاری)
              </Label>
              <select
                id="reminder-customer"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <option value="">بدون مشتری</option>
                {(customers ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reminder-broker" className="text-xs">
                دلال (اختیاری)
              </Label>
              <select
                id="reminder-broker"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={brokerId}
                onChange={(event) => setBrokerId(event.target.value)}
              >
                <option value="">بدون دلال</option>
                {(brokers ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reminder-property" className="text-xs">
                ملک / فایل (اختیاری)
              </Label>
              <select
                id="reminder-property"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={propertyId}
                onChange={(event) => setPropertyId(event.target.value)}
              >
                <option value="">بدون فایل</option>
                {(properties ?? []).slice(0, 300).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.file_code ? `${faDigits(item.file_code)} · ` : ""}
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reminder-notes" className="text-xs">
                توضیحات / یادداشت
              </Label>
              <Textarea
                id="reminder-notes"
                rows={3}
                value={form.notes ?? ""}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="h-11 flex-1"
                disabled={!canSave || save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {editingId ? "ذخیره تغییرات" : "ثبت یادآور"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={reset}
              >
                انصراف
              </Button>
            </div>
            {!canSave ? (
              <p className="text-[11px] text-muted-foreground">
                یک عنوان بنویسید یا یادآور را به مشتری، دلال یا فایل وصل کنید.
              </p>
            ) : null}
          </section>
        ) : null}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          (["overdue", "today", "upcoming", "doneToday"] as Bucket[]).map((bucket) => {
            const list = groups[bucket];
            if (!list.length) return null;
            return (
              <section key={bucket} className="surface-card space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${BUCKET_TONE[bucket]}`}
                  >
                    <BellRing className="size-4" />
                  </div>
                  <h2 className="text-sm font-bold">{BUCKET_LABELS[bucket]}</h2>
                  <span
                    className={`ms-auto rounded-full px-2 py-0.5 text-xs font-bold ${BUCKET_TONE[bucket]}`}
                  >
                    {faDigits(list.length)}
                  </span>
                </div>

                <ul className="space-y-2">
                  {list.map((item) => {
                    const cName = customerName(item.customer_id);
                    const bName = brokerName(item.broker_id);
                    const pTitle = propertyTitle(item.property_id);
                    const phone = customerPhone(item.customer_id);
                    return (
                      <li key={item.id} className="rounded-xl bg-secondary/60 p-3">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-bold">
                              {reminderSubject(item)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {item.all_day
                                ? faDate(item.next_at)
                                : faDateTime(item.next_at)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${PRIORITY_TONE[item.priority]}`}
                          >
                            {FOLLOW_UP_PRIORITY_LABELS[item.priority]}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <FollowUpKindBadge kind={item.kind} />
                          {cName ? (
                            <Link
                              to="/customers/$id"
                              params={{ id: item.customer_id ?? "" }}
                              className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                            >
                              <UserRound className="size-3.5" />
                              {cName}
                            </Link>
                          ) : null}
                          {bName ? (
                            <Link
                              to="/brokers/$id"
                              params={{ id: item.broker_id ?? "" }}
                              className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                            >
                              <Users className="size-3.5" />
                              {bName}
                            </Link>
                          ) : null}
                          {pTitle ? (
                            <Link
                              to="/listings/$id"
                              params={{ id: item.property_id ?? "" }}
                              className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                            >
                              <Building2 className="size-3.5" />
                              <span className="max-w-[10rem] truncate">{pTitle}</span>
                              <ChevronLeft className="size-3" />
                            </Link>
                          ) : null}
                        </div>

                        {item.notes ? (
                          <p className="mt-2 break-words rounded-lg bg-background/60 p-2 text-[11px] leading-5 text-muted-foreground">
                            {item.notes}
                          </p>
                        ) : null}

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {phone ? (
                            <a
                              href={`tel:${phone}`}
                              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 text-xs font-semibold text-primary"
                            >
                              <Phone className="size-3.5" />
                              تماس
                            </a>
                          ) : null}
                          {item.status === "done" ? (
                            <button
                              type="button"
                              onClick={() => reopen.mutate(item.id)}
                              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold"
                            >
                              بازگشت به باز
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => complete.mutate(item.id)}
                              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold"
                            >
                              <Check className="size-3.5" />
                              انجام شد
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            aria-label="ویرایش یادآور"
                            className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <ConfirmDialog
                            trigger={
                              <button
                                type="button"
                                aria-label="حذف یادآور"
                                className="flex size-10 items-center justify-center rounded-xl border border-border text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            }
                            title="حذف یادآور"
                            name={reminderSubject(item)}
                            description="این یادآور برای همیشه حذف می‌شود."
                            confirmLabel="حذف یادآور"
                            pending={remove.isPending}
                            onConfirm={() => remove.mutate(item.id)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}

        {!isLoading &&
        !groups.overdue.length &&
        !groups.today.length &&
        !groups.upcoming.length &&
        !groups.doneToday.length ? (
          <EmptyState
            icon={BellRing}
            title="یادآوری ثبت نشده است"
            description="با دکمه بالا یادآور جدید بسازید: پیگیری مشتری، فایل، دلال، تماس یا کار شخصی."
          />
        ) : null}
      </div>
    </AppShell>
  );
}
