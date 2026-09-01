import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  Loader2,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AdminOnly } from "@/components/AdminOnly";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, LoadingBlock } from "@/components/StateBlocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  brokerFreshness,
  createBroker,
  daysSinceUpdate,
  deleteBroker,
  emptyBroker,
  fetchBrokers,
  FRESHNESS_LABELS,
  FRESHNESS_TONE,
  needsUpdate,
  staleFirst,
  touchBroker,
  updateBroker,
  type BrokerInput,
} from "@/lib/brokers";
import { enDigits, faDigits, faRelative } from "@/lib/fa";
import { fetchProperties, STATUS_LABELS, type PropertyStatus } from "@/lib/properties";

export const Route = createFileRoute("/brokers")({
  head: () => ({
    meta: [
      { title: "دلال‌ها | املاک صدرا" },
      {
        name: "description",
        content: "مدیریت دلال‌ها و فایل‌های ملکی معرفی‌شده توسط هر دلال در شهر صدرا.",
      },
      { property: "og:title", content: "دلال‌ها" },
      {
        property: "og:description",
        content: "ثبت دلال‌ها و نگه‌داری فایل‌های ملکی مربوط به هر دلال.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    due: search['due'] === true || search['due'] === "true" ? true : undefined,
  }),
  component: BrokersRoute,
});

function BrokersRoute() {
  return <AdminOnly>{(userId) => <Brokers userId={userId} />}</AdminOnly>;
}

function Brokers({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { due } = Route.useSearch();
  const [form, setForm] = useState<BrokerInput>(emptyBroker);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyDue, setOnlyDue] = useState(Boolean(due));
  const [sortStale, setSortStale] = useState(Boolean(due));

  const { data: brokers, isLoading } = useQuery({
    queryKey: ["brokers"],
    queryFn: fetchBrokers,
  });
  const { data: properties } = useQuery({
    queryKey: ["properties"],
    queryFn: fetchProperties,
  });

  const query = enDigits(search).trim().toLowerCase();
  const dueCount = (brokers ?? []).filter(needsUpdate).length;
  const filtered = (brokers ?? []).filter((broker) => {
    if (onlyDue && !needsUpdate(broker)) return false;
    if (!query) return true;
    const haystack = [broker.name, broker.agency, broker.notes, broker.phone, enDigits(broker.phone ?? "")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return query.split(/\s+/).every((token) => haystack.includes(token));
  });
  const visible = sortStale ? [...filtered].sort(staleFirst) : filtered;

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["brokers"] }),
      queryClient.invalidateQueries({ queryKey: ["properties"] }),
    ]);
  }

  const save = useMutation({
    mutationFn: () =>
      editingId ? updateBroker(editingId, form) : createBroker(form, userId),
    onSuccess: async () => {
      await invalidate();
      toast.success(editingId ? "دلال ویرایش شد" : "دلال اضافه شد");
      setForm(emptyBroker);
      setEditingId(null);
      setOpen(false);
    },
    onError: () => toast.error("ذخیره ناموفق بود"),
  });

  const touch = useMutation({
    mutationFn: (id: string) => touchBroker(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("بروزرسانی دلال ثبت شد");
    },
    onError: () => toast.error("ثبت بروزرسانی ناموفق بود"),
  });

  const removal = useMutation({
    mutationFn: (id: string) => deleteBroker(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("دلال حذف شد");
    },
    onError: () => toast.error("حذف ناموفق بود"),
  });

  return (
    <AppShell
      title="دلال‌ها"
      subtitle={`${faDigits(brokers?.length ?? 0)} دلال · ${faDigits(dueCount)} نیازمند بروزرسانی`}
      action={
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm(emptyBroker);
            setOpen((value) => !value);
          }}
          aria-label="افزودن دلال"
          className="flex size-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary"
        >
          <Plus className="size-4" />
        </button>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجوی دلال بر اساس نام، نام مستعار یا موبایل"
            className="h-11 rounded-xl pr-10 text-sm"
            aria-label="جستجوی دلال"
          />
          {search ? (
            <button
              type="button"
              aria-label="پاک کردن جستجو"
              onClick={() => setSearch("")}
              className="absolute left-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={onlyDue}
            onClick={() => setOnlyDue((value) => !value)}
            className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
              onlyDue
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            <RefreshCw className="size-3.5" />
            نیاز به بروزرسانی ({faDigits(dueCount)})
          </button>
          <button
            type="button"
            aria-pressed={sortStale}
            onClick={() => setSortStale((value) => !value)}
            className={`flex h-10 flex-1 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-colors ${
              sortStale
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            مرتب‌سازی: قدیمی‌ترین بروزرسانی
          </button>
        </div>

        {open ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.name.trim()) {
                toast.error("نام دلال را وارد کنید");
                return;
              }
              save.mutate();
            }}
            className="surface-card space-y-3 p-4"
          >
            <h2 className="text-sm font-bold text-primary">
              {editingId ? "ویرایش دلال" : "دلال جدید"}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">نام دلال</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">شماره تماس</Label>
                <Input
                  dir="ltr"
                  inputMode="tel"
                  className="text-left"
                  value={form.phone ?? ""}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">آژانس / محل کار</Label>
              <Input
                value={form.agency ?? ""}
                onChange={(event) => setForm({ ...form, agency: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">فاصله بروزرسانی (روز)</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                className="text-left"
                value={String(form.update_interval_days ?? 14)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    update_interval_days:
                      Number(enDigits(event.target.value).replace(/\D/g, "")) || 14,
                  })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                اگر بیشتر از این مدت از آخرین تماس بگذرد، دلال در فهرست «نیاز به بروزرسانی» می‌آید.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">یادداشت</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
            <Button type="submit" disabled={save.isPending} className="h-11 w-full">
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "ذخیره"}
            </Button>
          </form>
        ) : null}

        {isLoading ? (
          <LoadingBlock label="در حال بارگذاری دلال‌ها…" />
        ) : visible.length ? (
          visible.map((broker) => {
            const own = (properties ?? []).filter((item) => item.broker_id === broker.id);
            const state = brokerFreshness(broker);
            const days = daysSinceUpdate(broker);
            return (
              <section key={broker.id} className="surface-card space-y-3 p-4">
                <div className="flex items-start gap-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Users className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{broker.name}</p>
                    {broker.agency ? (
                      <p className="truncate text-xs text-muted-foreground">{broker.agency}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="ویرایش دلال"
                    onClick={() => {
                      setEditingId(broker.id);
                      setForm({
                        name: broker.name,
                        phone: broker.phone,
                        agency: broker.agency,
                        notes: broker.notes,
                        update_interval_days: broker.update_interval_days ?? 14,
                      });
                      setOpen(true);
                    }}
                    className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <ConfirmDialog
                    title="حذف دلال"
                    name={broker.name}
                    description="با حذف دلال، فایل‌های ثبت‌شده حذف نمی‌شوند اما ارتباط آن‌ها با این دلال از بین می‌رود."
                    pending={removal.isPending}
                    onConfirm={() => removal.mutate(broker.id)}
                    trigger={
                      <button
                        type="button"
                        aria-label="حذف دلال"
                        className="flex size-9 items-center justify-center rounded-lg border border-border text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    }
                  />
                </div>

                {broker.phone ? (
                  <a
                    href={`tel:${broker.phone}`}
                    className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
                  >
                    <Phone className="size-4" />
                    <span dir="ltr">{faDigits(broker.phone)}</span>
                  </a>
                ) : null}

                <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
                  <span
                    className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${FRESHNESS_TONE[state]}`}
                  >
                    {FRESHNESS_LABELS[state]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                    {days === null
                      ? "آخرین بروزرسانی ثبت نشده"
                      : `آخرین بروزرسانی ${faRelative(broker.last_contact_at)} (${faDigits(days)} روز پیش)`}
                  </span>
                  <button
                    type="button"
                    onClick={() => touch.mutate(broker.id)}
                    disabled={touch.isPending}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 px-2.5 text-[11px] font-semibold text-primary"
                  >
                    {touch.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    بروزرسانی شد
                  </button>
                </div>

                {broker.notes ? (
                  <p className="text-xs leading-6 text-muted-foreground">{broker.notes}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full bg-primary/15 px-2 py-1 font-semibold text-primary">
                    {faDigits(own.length)} فایل
                  </span>
                  {(Object.keys(STATUS_LABELS) as PropertyStatus[]).map((status) => (
                    <span
                      key={status}
                      className="rounded-lg bg-secondary/70 px-2 py-1 text-muted-foreground"
                    >
                      {STATUS_LABELS[status]}: {faDigits(own.filter((i) => i.status === status).length)}
                    </span>
                  ))}
                </div>

                {own.length ? (
                  <ul className="grid gap-1.5">
                    {own.slice(0, 3).map((item) => (
                      <li key={item.id}>
                        <Link
                          to="/listings/$id"
                          params={{ id: item.id }}
                          className="block truncate rounded-xl bg-secondary/60 px-3 py-2 text-xs"
                        >
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <Button asChild className="h-10 w-full">
                    <Link to="/brokers/$id" params={{ id: broker.id }}>
                      فایل‌های این دلال
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="h-10 w-full">
                    <Link to="/listings/new" search={{ broker: broker.id }}>
                      افزودن فایل
                    </Link>
                  </Button>
                </div>
              </section>
            );
          })
        ) : (
          <EmptyState
            icon={Users}
            title={
              query || onlyDue ? "دلالی با این شرایط پیدا نشد" : "هنوز دلالی ثبت نشده است"
            }
            description={
              query || onlyDue
                ? "جستجو یا فیلتر «نیاز به بروزرسانی» را تغییر دهید."
                : "با دکمه + بالای صفحه اولین دلال را اضافه کنید."
            }
          />
        )}
      </div>
    </AppShell>
  );
}
