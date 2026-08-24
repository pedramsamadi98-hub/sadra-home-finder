import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminOnly } from "@/components/AdminOnly";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCustomer,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_TONE,
  customerMatchesQuery,
  deleteCustomer,
  emptyCustomer,
  fetchCustomers,
  fetchRequirements,
  REQ_OWNERSHIP_LABELS,
  REQ_TRANSACTION_LABELS,
  updateCustomer,
  type CustomerInput,
  type CustomerStatus,
} from "@/lib/customers";
import { faDigits } from "@/lib/fa";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "مشتری‌ها | املاک صدرا" },
      {
        name: "description",
        content:
          "ثبت و مدیریت مشتری‌ها همراه با نیاز ملکی دقیق هر مشتری و تطبیق با فایل‌های موجود.",
      },
      { property: "og:title", content: "مشتری‌ها" },
      {
        property: "og:description",
        content: "مدیریت مشتری‌ها، نیاز ملکی و تطبیق هوشمند با فایل‌های ملکی.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersRoute,
});

function CustomersRoute() {
  return <AdminOnly>{(userId) => <Customers userId={userId} />}</AdminOnly>;
}

function Customers({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomerInput>(emptyCustomer);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "all">("all");

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
  });
  const { data: requirements } = useQuery({
    queryKey: ["customer_requirements"],
    queryFn: () => fetchRequirements(),
  });

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customer_requirements"] }),
    ]);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) await updateCustomer(editingId, form);
      else await createCustomer(form, userId);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(editingId ? "مشتری ویرایش شد" : "مشتری اضافه شد");
      setForm(emptyCustomer);
      setEditingId(null);
      setOpen(false);
    },
    onError: () => toast.error("ذخیره ناموفق بود"),
  });

  const removal = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("مشتری حذف شد");
    },
    onError: () => toast.error("حذف ناموفق بود"),
  });

  const filtered = (customers ?? []).filter((customer) => {
    if (statusFilter !== "all" && customer.status !== statusFilter) return false;
    const reqs = (requirements ?? []).filter((r) => r.customer_id === customer.id);
    return customerMatchesQuery(customer, reqs, search);
  });

  return (
    <AppShell
      title="مشتری‌ها"
      subtitle={`${faDigits(customers?.length ?? 0)} مشتری ثبت شده`}
      action={
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm(emptyCustomer);
            setOpen((value) => !value);
          }}
          aria-label="افزودن مشتری"
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
            placeholder="جستجو: نام، موبایل، نوع معامله، شهر، فاز…"
            className="h-11 rounded-xl pr-10 text-sm"
            aria-label="جستجوی مشتری"
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

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(["all", ...(Object.keys(CUSTOMER_STATUS_LABELS) as CustomerStatus[])] as const).map(
            (key) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key as CustomerStatus | "all")}
                className={`h-9 shrink-0 rounded-xl border px-3 text-xs font-medium transition-colors ${
                  statusFilter === key
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {key === "all" ? "همه" : CUSTOMER_STATUS_LABELS[key as CustomerStatus]}
              </button>
            ),
          )}
        </div>

        {open ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.full_name.trim()) {
                toast.error("نام مشتری را وارد کنید");
                return;
              }
              save.mutate();
            }}
            className="surface-card space-y-3 p-4"
          >
            <h2 className="text-sm font-bold text-primary">
              {editingId ? "ویرایش مشتری" : "مشتری جدید"}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">نام و نام خانوادگی</Label>
                <Input
                  value={form.full_name}
                  onChange={(event) => setForm({ ...form, full_name: event.target.value })}
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
              <Label className="text-xs">وضعیت مشتری</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CUSTOMER_STATUS_LABELS) as CustomerStatus[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, status: key })}
                    className={`h-9 rounded-xl border px-3 text-xs font-medium transition-colors ${
                      form.status === key
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {CUSTOMER_STATUS_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">توضیحات و یادداشت</Label>
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
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : filtered.length ? (
          filtered.map((customer) => {
            const reqs = (requirements ?? []).filter((r) => r.customer_id === customer.id);
            return (
              <section key={customer.id} className="surface-card space-y-3 p-4">
                <div className="flex items-start gap-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <UserRound className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/customers/$id"
                      params={{ id: customer.id }}
                      className="block truncate text-sm font-bold text-primary"
                    >
                      {customer.full_name}
                    </Link>
                    <span
                      className={`mt-1 inline-block rounded-lg px-2 py-0.5 text-[11px] font-medium ${CUSTOMER_STATUS_TONE[customer.status]}`}
                    >
                      {CUSTOMER_STATUS_LABELS[customer.status]}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="ویرایش مشتری"
                    onClick={() => {
                      setEditingId(customer.id);
                      setForm({
                        full_name: customer.full_name,
                        phone: customer.phone,
                        notes: customer.notes,
                        status: customer.status,
                      });
                      setOpen(true);
                    }}
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="حذف مشتری"
                    onClick={() => {
                      if (
                        window.confirm(
                          "این مشتری و همه نیازها و پیگیری‌های او حذف شود؟",
                        )
                      )
                        removal.mutate(customer.id);
                    }}
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
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

                {reqs.length ? (
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {reqs.map((req) => (
                      <span
                        key={req.id}
                        className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground"
                      >
                        {REQ_TRANSACTION_LABELS[req.transaction_type]} •{" "}
                        {REQ_OWNERSHIP_LABELS[req.ownership_type]}
                        {req.phase ? ` • ${req.phase}` : ""}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    نیاز ملکی ثبت نشده است.
                  </p>
                )}

                <Button asChild variant="secondary" className="h-10 w-full">
                  <Link to="/customers/$id" params={{ id: customer.id }}>
                    جزئیات و فایل‌های مناسب
                    <ChevronLeft className="size-4" />
                  </Link>
                </Button>
              </section>
            );
          })
        ) : (
          <p className="surface-card p-6 text-center text-xs text-muted-foreground">
            مشتری‌ای یافت نشد.
          </p>
        )}
      </div>
    </AppShell>
  );
}
