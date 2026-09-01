import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminOnly } from "@/components/AdminOnly";
import { AppShell } from "@/components/AppShell";
import { FollowUpSection } from "@/components/FollowUpSection";
import { MatchChecks, MatchScoreBadge } from "@/components/MatchBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createRequirement,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_TONE,
  deleteRequirement,
  emptyRequirement,
  fetchCustomer,
  fetchRequirements,
  matchProperty,
  MATCH_THRESHOLD,
  REQ_OWNERSHIP_LABELS,
  REQ_TRANSACTION_LABELS,
  updateRequirement,
  type ReqOwnershipType,
  type ReqTransactionType,
  type RequirementInput,
} from "@/lib/customers";
import { faArea, faDigits, faPrice, parseNumber } from "@/lib/fa";
import { fetchProperties, PHASES, STATUS_LABELS } from "@/lib/properties";

export const Route = createFileRoute("/customers_/$id")({
  head: () => ({
    meta: [
      { title: "جزئیات مشتری | املاک صدرا" },
      {
        name: "description",
        content: "نیاز ملکی مشتری، پیگیری‌ها و فایل‌های ملکی مناسب همان مشتری.",
      },
      { property: "og:title", content: "جزئیات مشتری" },
      {
        property: "og:description",
        content: "مشاهده نیاز مشتری و فایل‌های ملکی منطبق با آن.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerDetailRoute,
});

function CustomerDetailRoute() {
  return <AdminOnly>{(userId) => <CustomerDetail userId={userId} />}</AdminOnly>;
}

function numberInput(value: number | null) {
  return value === null ? "" : String(value);
}

function CustomerDetail({ userId }: { userId: string }) {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RequirementInput>({ ...emptyRequirement });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id),
  });
  const { data: requirements } = useQuery({
    queryKey: ["customer_requirements", id],
    queryFn: () => fetchRequirements(id),
  });
  const { data: properties } = useQuery({
    queryKey: ["properties"],
    queryFn: fetchProperties,
  });

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customer_requirements"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) await updateRequirement(editingId, form);
      else await createRequirement(id, form, userId);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(editingId ? "نیاز ویرایش شد" : "نیاز ثبت شد");
      setForm({ ...emptyRequirement });
      setEditingId(null);
      setOpen(false);
    },
    onError: () => toast.error("ذخیره نیاز ناموفق بود"),
  });

  const removal = useMutation({
    mutationFn: (reqId: string) => deleteRequirement(reqId),
    onSuccess: async () => {
      await invalidate();
      toast.success("نیاز حذف شد");
    },
    onError: () => toast.error("حذف ناموفق بود"),
  });

  if (isLoading) {
    return (
      <AppShell title="جزئیات مشتری">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!customer) {
    return (
      <AppShell title="جزئیات مشتری">
        <p className="surface-card p-6 text-center text-sm">مشتری پیدا نشد.</p>
      </AppShell>
    );
  }

  const reqs = requirements ?? [];
  const activeProperties = (properties ?? []).filter((p) => p.status === "active");

  const matches = reqs.flatMap((req) =>
    activeProperties
      .map((property) => ({ property, req, result: matchProperty(property, req) }))
      .filter((row) => !row.result.blocked && row.result.score >= MATCH_THRESHOLD),
  );
  // keep the best row per property
  const bestByProperty = new Map<string, (typeof matches)[number]>();
  for (const row of matches) {
    const prev = bestByProperty.get(row.property.id);
    if (!prev || row.result.score > prev.result.score)
      bestByProperty.set(row.property.id, row);
  }
  const matchRows = [...bestByProperty.values()].sort(
    (a, b) => b.result.score - a.result.score,
  );

  return (
    <AppShell title={customer.full_name} subtitle={CUSTOMER_STATUS_LABELS[customer.status]}>
      <div className="space-y-4">
        <section className="surface-card space-y-3 p-4">
          <div className="flex items-start gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <UserRound className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{customer.full_name}</p>
              <span
                className={`mt-1 inline-block rounded-lg px-2 py-0.5 text-[11px] font-medium ${CUSTOMER_STATUS_TONE[customer.status]}`}
              >
                {CUSTOMER_STATUS_LABELS[customer.status]}
              </span>
            </div>
          </div>
          {customer.phone ? (
            <a
              href={`tel:${customer.phone}`}
              className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
            >
              <Phone className="size-4" />
              <span dir="ltr">{faDigits(customer.phone)}</span>
            </a>
          ) : null}
          {customer.notes ? (
            <p className="text-xs leading-6 text-muted-foreground">{customer.notes}</p>
          ) : null}
          <Button asChild variant="secondary" className="h-10 w-full">
            <Link to="/customers">بازگشت به فهرست مشتری‌ها</Link>
          </Button>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">نیازهای ملکی ({faDigits(reqs.length)})</h2>
            <Button
              type="button"
              size="sm"
              variant={open ? "secondary" : "default"}
              className="h-9"
              onClick={() => {
                setEditingId(null);
                setForm({ ...emptyRequirement });
                setOpen((v) => !v);
              }}
            >
              {open ? <X className="size-4" /> : <Plus className="size-4" />}
              {open ? "بستن" : "افزودن نیاز"}
            </Button>
          </div>

          {open ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
              className="surface-card space-y-3 p-4"
            >
              <div className="space-y-1.5">
                <Label className="text-xs">نوع معامله</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(REQ_TRANSACTION_LABELS) as ReqTransactionType[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, transaction_type: key })}
                      className={`h-9 rounded-xl border px-3 text-xs font-medium ${
                        form.transaction_type === key
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {REQ_TRANSACTION_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">نوع ملک</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(REQ_OWNERSHIP_LABELS) as ReqOwnershipType[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, ownership_type: key })}
                      className={`h-9 rounded-xl border px-3 text-xs font-medium ${
                        form.ownership_type === key
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {REQ_OWNERSHIP_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">شهر</Label>
                  <Input
                    value={form.city ?? ""}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">فاز</Label>
                  <Input
                    list="phase-options"
                    value={form.phase ?? ""}
                    onChange={(e) => setForm({ ...form, phase: e.target.value })}
                  />
                  <datalist id="phase-options">
                    {PHASES.map((phase) => (
                      <option key={phase} value={phase} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">محله</Label>
                <Input
                  value={form.neighborhood ?? ""}
                  onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">حداقل متراژ</Label>
                  <Input
                    inputMode="numeric"
                    value={numberInput(form.min_area)}
                    onChange={(e) =>
                      setForm({ ...form, min_area: parseNumber(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">حداکثر متراژ</Label>
                  <Input
                    inputMode="numeric"
                    value={numberInput(form.max_area)}
                    onChange={(e) =>
                      setForm({ ...form, max_area: parseNumber(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">تعداد خواب (حداقل)</Label>
                <Input
                  inputMode="numeric"
                  value={numberInput(form.bedrooms)}
                  onChange={(e) =>
                    setForm({ ...form, bedrooms: parseNumber(e.target.value) })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MoneyInput
                  label="حداقل بودجه (تومان)"
                  value={form.min_budget}
                  onChange={(min_budget) => setForm({ ...form, min_budget })}
                />
                <MoneyInput
                  label="حداکثر بودجه (تومان)"
                  value={form.max_budget}
                  onChange={(max_budget) => setForm({ ...form, max_budget })}
                />
              </div>


              <div className="space-y-1.5">
                <Label className="text-xs">امکانات موردنیاز</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["needs_parking", "پارکینگ"],
                      ["needs_elevator", "آسانسور"],
                      ["needs_storage", "انباری"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, [key]: !form[key] })}
                      className={`h-10 rounded-xl border text-xs font-medium ${
                        form[key]
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {label}
                      <span className="block text-[10px]">
                        {form[key] ? "مهم است" : "مهم نیست"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">توضیحات نیاز</Label>
                <Textarea
                  rows={2}
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <Button type="submit" disabled={save.isPending} className="h-11 w-full">
                {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "ذخیره نیاز"}
              </Button>
            </form>
          ) : null}

          {reqs.length ? (
            reqs.map((req) => (
              <div key={req.id} className="surface-card space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm font-bold text-primary">
                    {REQ_TRANSACTION_LABELS[req.transaction_type]} •{" "}
                    {REQ_OWNERSHIP_LABELS[req.ownership_type]}
                  </p>
                  <button
                    type="button"
                    aria-label="ویرایش نیاز"
                    onClick={() => {
                      setEditingId(req.id);
                      setForm({
                        transaction_type: req.transaction_type,
                        ownership_type: req.ownership_type,
                        city: req.city,
                        phase: req.phase,
                        neighborhood: req.neighborhood,
                        min_area: req.min_area,
                        max_area: req.max_area,
                        bedrooms: req.bedrooms,
                        min_budget: req.min_budget,
                        max_budget: req.max_budget,
                        needs_parking: req.needs_parking,
                        needs_elevator: req.needs_elevator,
                        needs_storage: req.needs_storage,
                        description: req.description,
                      });
                      setOpen(true);
                    }}
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="حذف نیاز"
                    onClick={() => {
                      if (window.confirm("این نیاز حذف شود؟")) removal.mutate(req.id);
                    }}
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[req.city, req.phase, req.neighborhood].filter(Boolean).join(" — ") || "—"}
                </p>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-secondary px-2 py-0.5">
                    متراژ: {req.min_area || req.max_area
                      ? `${faDigits(req.min_area ?? "—")} تا ${faDigits(req.max_area ?? "—")}`
                      : "مهم نیست"}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5">
                    خواب: {req.bedrooms !== null ? faDigits(req.bedrooms) : "مهم نیست"}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5">
                    بودجه: {req.max_budget ? `تا ${faPrice(req.max_budget)}` : "مهم نیست"}
                  </span>
                  {req.needs_parking ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5">پارکینگ لازم</span>
                  ) : null}
                  {req.needs_elevator ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5">آسانسور لازم</span>
                  ) : null}
                  {req.needs_storage ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5">انباری لازم</span>
                  ) : null}
                </div>
                {req.description ? (
                  <p className="text-xs leading-6 text-muted-foreground">{req.description}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="surface-card p-4 text-center text-xs text-muted-foreground">
              برای این مشتری نیاز ملکی ثبت نشده است.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold">
            فایل‌های مناسب این مشتری ({faDigits(matchRows.length)})
          </h2>
          {!reqs.length ? (
            <p className="surface-card p-4 text-center text-xs text-muted-foreground">
              اول یک نیاز ملکی ثبت کنید.
            </p>
          ) : matchRows.length ? (
            matchRows.map(({ property, req, result }) => (
              <div key={property.id} className="surface-card space-y-2 p-4">
                <div className="flex items-start gap-2">
                  <Link
                    to="/listings/$id"
                    params={{ id: property.id }}
                    className="min-w-0 flex-1 truncate text-sm font-bold text-primary"
                  >
                    {property.title}
                  </Link>
                  <MatchScoreBadge score={result.score} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {[property.city, property.phase, property.neighborhood]
                    .filter(Boolean)
                    .join(" — ")}{" "}
                  • {faArea(property.area)} •{" "}
                  {property.transaction_type === "sale"
                    ? faPrice(property.price)
                    : `${faPrice(property.deposit)} رهن`}{" "}
                  • {STATUS_LABELS[property.status]}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  بر اساس نیاز: {REQ_TRANSACTION_LABELS[req.transaction_type]} •{" "}
                  {REQ_OWNERSHIP_LABELS[req.ownership_type]}
                </p>
                <MatchChecks checks={result.checks} />
                <Button asChild variant="secondary" className="h-10 w-full">
                  <Link to="/listings/$id" params={{ id: property.id }}>
                    مشاهده فایل
                    <ChevronLeft className="size-4" />
                  </Link>
                </Button>
              </div>
            ))
          ) : (
            <p className="surface-card p-4 text-center text-xs text-muted-foreground">
              فعلاً فایلی منطبق با نیاز این مشتری وجود ندارد.
            </p>
          )}
        </section>

        <FollowUpSection
          customerId={customer.id}
          userId={userId}
          canEdit={customer.user_id === userId}
          title="پیگیری مشتری"
        />
      </div>
    </AppShell>
  );
}
