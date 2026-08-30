import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  Footprints,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/StateBlocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { faDateTime } from "@/lib/fa";
import {
  createFollowUp,
  deleteFollowUp,
  emptyFollowUp,
  fetchFollowUps,
  FOLLOW_UP_KIND_LABELS,
  FOLLOW_UP_PRIORITY_LABELS,
  FOLLOW_UP_STATUS_LABELS,
  followUpKind,
  fromLocalInput,
  setFollowUpStatus,
  sortFollowUps,
  toLocalInput,
  type FollowUpInput,
  type FollowUpKind,
  type FollowUpPriority,
  type FollowUpStatus,
} from "@/lib/follow-ups";

export const PRIORITY_TONE: Record<FollowUpPriority, string> = {
  normal: "bg-secondary text-muted-foreground",
  important: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

export const STATUS_TONE: Record<FollowUpStatus, string> = {
  pending: "bg-primary/15 text-primary",
  done: "bg-success/15 text-success",
  canceled: "bg-muted text-muted-foreground",
};

export const KIND_ICONS: Record<FollowUpKind, LucideIcon> = {
  call: Phone,
  visit: Footprints,
  message: MessageSquare,
};

/** Small labelled badge for the contact channel of a follow-up. */
export function FollowUpKindBadge({ kind }: { kind: string | null | undefined }) {
  const key = followUpKind(kind);
  const Icon = KIND_ICONS[key];
  return (
    <span className="flex items-center gap-1 rounded-lg bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Icon className="size-3.5" />
      {FOLLOW_UP_KIND_LABELS[key]}
    </span>
  );
}


function Chips<T extends string>({
  value,
  labels,
  onChange,
}: {
  value: T;
  labels: Record<T, string>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(labels) as T[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`h-9 rounded-xl border px-3 text-xs font-medium transition-colors ${
            value === key
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          {labels[key]}
        </button>
      ))}
    </div>
  );
}

export function FollowUpSection({
  propertyId,
  customerId,
  userId,
  canEdit,
  title = "پیگیری فایل",
}: {
  propertyId?: string;
  customerId?: string;
  userId: string;
  canEdit: boolean;
  title?: string;
}) {
  const target = { propertyId: propertyId ?? null, customerId: customerId ?? null };
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FollowUpInput>({ ...emptyFollowUp });

  const { data, isLoading } = useQuery({
    queryKey: ["follow_ups", propertyId ?? null, customerId ?? null],
    queryFn: () => fetchFollowUps(target),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["follow_ups"] });
  };

  const create = useMutation({
    mutationFn: () => createFollowUp(target, form, userId),
    onSuccess: async () => {
      await refresh();
      setForm({ ...emptyFollowUp });
      setOpen(false);
      toast.success("پیگیری ثبت شد");
    },
    onError: () => toast.error("ثبت پیگیری ناموفق بود"),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FollowUpStatus }) =>
      setFollowUpStatus(id, status),
    onSuccess: async () => {
      await refresh();
      toast.success("وضعیت پیگیری تغییر کرد");
    },
    onError: () => toast.error("تغییر وضعیت ناموفق بود"),
  });

  const removal = useMutation({
    mutationFn: (id: string) => deleteFollowUp(id),
    onSuccess: async () => {
      await refresh();
      toast.success("پیگیری حذف شد");
    },
    onError: () => toast.error("حذف ناموفق بود"),
  });

  const items = sortFollowUps(data ?? [], "priority");
  const history = [...(data ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const nextPending = items.find((item) => item.status === "pending" && item.next_at);
  const last = history[0] ?? null;

  return (
    <section className="surface-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <CalendarClock className="size-4 text-primary" />
          {title}
        </h2>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant={open ? "secondary" : "default"}
            className="h-9"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Plus className="size-4" />}
            {open ? "بستن" : "ثبت پیگیری"}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2 text-xs">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
          <span className="text-muted-foreground">آخرین پیگیری</span>
          <span className="flex items-center gap-2 font-medium">
            {last ? <FollowUpKindBadge kind={last.kind} /> : null}
            {faDateTime(last?.called_at ?? last?.created_at ?? null)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
          <span className="text-muted-foreground">نتیجه</span>
          <span className="truncate font-medium">{last?.call_result || "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
          <span className="text-muted-foreground">پیگیری بعدی</span>
          <span className="font-medium">{faDateTime(nextPending?.next_at ?? null)}</span>
        </div>
      </div>

      {open && canEdit ? (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">نوع پیگیری</label>
            <Chips
              value={form.kind}
              labels={FOLLOW_UP_KIND_LABELS}
              onChange={(kind) => setForm((f) => ({ ...f, kind }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">تاریخ و ساعت</label>
            <Input
              type="datetime-local"
              className="h-11"
              value={toLocalInput(form.called_at)}
              onChange={(e) =>
                setForm((f) => ({ ...f, called_at: fromLocalInput(e.target.value) }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">نتیجه</label>
            <Input
              className="h-11"
              value={form.call_result ?? ""}
              placeholder="مثلاً: جواب نداد / قیمت را کاهش داد"
              onChange={(e) => setForm((f) => ({ ...f, call_result: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">پیگیری بعدی</label>
            <Input
              type="datetime-local"
              className="h-11"
              value={toLocalInput(form.next_at)}
              onChange={(e) =>
                setForm((f) => ({ ...f, next_at: fromLocalInput(e.target.value) }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">یادداشت</label>
            <Textarea
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">وضعیت</label>
            <Chips
              value={form.status}
              labels={FOLLOW_UP_STATUS_LABELS}
              onChange={(status) => setForm((f) => ({ ...f, status }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">اولویت</label>
            <Chips
              value={form.priority}
              labels={FOLLOW_UP_PRIORITY_LABELS}
              onChange={(priority) => setForm((f) => ({ ...f, priority }))}
            />
          </div>
          <Button
            type="button"
            className="h-11 w-full"
            disabled={create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            ثبت پیگیری
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-muted-foreground">تاریخچه پیگیری‌ها</h3>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : history.length ? (
          history.map((item) => (
            <div key={item.id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[item.status]}`}
                >
                  {FOLLOW_UP_STATUS_LABELS[item.status]}
                </span>
                <span
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${PRIORITY_TONE[item.priority]}`}
                >
                  {FOLLOW_UP_PRIORITY_LABELS[item.priority]}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                تماس: {faDateTime(item.called_at)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                پیگیری بعدی: {faDateTime(item.next_at)}
              </p>
              {item.call_result ? (
                <p className="text-xs">نتیجه: {item.call_result}</p>
              ) : null}
              {item.notes ? (
                <p className="text-xs leading-6 text-muted-foreground">{item.notes}</p>
              ) : null}
              {canEdit ? (
                <div className="flex gap-2">
                  {item.status !== "done" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-9 flex-1"
                      disabled={changeStatus.isPending}
                      onClick={() => changeStatus.mutate({ id: item.id, status: "done" })}
                    >
                      <Check className="size-4" />
                      انجام شد
                    </Button>
                  ) : null}
                  {item.status !== "canceled" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 flex-1"
                      disabled={changeStatus.isPending}
                      onClick={() =>
                        changeStatus.mutate({ id: item.id, status: "canceled" })
                      }
                    >
                      <X className="size-4" />
                      لغو
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-9"
                    disabled={removal.isPending}
                    onClick={() => {
                      if (window.confirm("این پیگیری حذف شود؟")) removal.mutate(item.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="py-3 text-center text-xs text-muted-foreground">
            هنوز پیگیری‌ای ثبت نشده است.
          </p>
        )}
      </div>
    </section>
  );
}
