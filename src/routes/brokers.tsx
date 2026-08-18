import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Pencil, Phone, Plus, Search, Trash2, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createBroker,
  deleteBroker,
  emptyBroker,
  fetchBrokers,
  updateBroker,
  type BrokerInput,
} from "@/lib/brokers";
import { enDigits, faDigits } from "@/lib/fa";
import { fetchProperties } from "@/lib/properties";

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
  component: BrokersRoute,
});

function BrokersRoute() {
  return <AuthGate>{(userId) => <Brokers userId={userId} />}</AuthGate>;
}

function Brokers({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BrokerInput>(emptyBroker);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: brokers, isLoading } = useQuery({
    queryKey: ["brokers"],
    queryFn: fetchBrokers,
  });
  const { data: properties } = useQuery({
    queryKey: ["properties"],
    queryFn: fetchProperties,
  });

  const query = enDigits(search).trim().toLowerCase();
  const filtered = (brokers ?? []).filter((broker) => {
    if (!query) return true;
    const haystack = [broker.name, broker.agency, broker.notes, broker.phone, enDigits(broker.phone ?? "")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return query.split(/\s+/).every((token) => haystack.includes(token));
  });

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
      subtitle={`${faDigits(brokers?.length ?? 0)} دلال ثبت شده`}
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
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : filtered.length ? (
          filtered.map((broker) => {
            const own = (properties ?? []).filter((item) => item.broker_id === broker.id);
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
                      });
                      setOpen(true);
                    }}
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="حذف دلال"
                    onClick={() => {
                      if (window.confirm("این دلال حذف شود؟")) removal.mutate(broker.id);
                    }}
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
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

                {broker.notes ? (
                  <p className="text-xs leading-6 text-muted-foreground">{broker.notes}</p>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  {faDigits(own.length)} فایل از این دلال
                </p>

                {own.length ? (
                  <ul className="grid gap-1.5">
                    {own.map((item) => (
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

                <Button asChild variant="secondary" className="h-10 w-full">
                  <Link to="/listings/new" search={{ broker: broker.id }}>
                    افزودن فایل برای این دلال
                  </Link>
                </Button>
              </section>
            );
          })
        ) : (
          <p className="surface-card p-6 text-center text-sm text-muted-foreground">
            {query
              ? "دلالی با این مشخصات پیدا نشد."
              : "هنوز دلالی ثبت نشده است. با دکمه + دلال جدید اضافه کنید."}
          </p>
        )}
      </div>
    </AppShell>
  );
}
