import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminOnly } from "@/components/AdminOnly";
import { AppShell } from "@/components/AppShell";
import { PropertyCard } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchBrokers } from "@/lib/brokers";
import { enDigits, faDigits } from "@/lib/fa";
import { normalizeFa } from "@/lib/land";
import { fetchPropertiesPage, restoreProperty, type PropertyStatus } from "@/lib/properties";

type Tab = "sold" | "rented" | "archived";
const TABS: { key: Tab; label: string }[] = [
  { key: "sold", label: "فروش رفته" },
  { key: "rented", label: "اجاره داده شده" },
  { key: "archived", label: "بایگانی دستی" },
];
const PAGE_SIZE = 20;
/** Cap on broker ids sent in one request (~7.4 KB of URL); warned when hit. */
const MAX_BROKER_IDS = 200;

export const Route = createFileRoute("/archive")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const tab = search["tab"];
    return tab === "sold" || tab === "rented" || tab === "archived" ? { tab } : {};
  },
  head: () => ({
    meta: [
      { title: "آرشیو املاک | املاک صدرا" },
      {
        name: "description",
        content: "آرشیو جداگانه فایل‌های فروش رفته، اجاره داده شده و بایگانی دستی با جست‌وجو و فعال‌سازی مجدد.",
      },
      { property: "og:title", content: "آرشیو املاک صدرا" },
      {
        property: "og:description",
        content: "فایل‌های فروش رفته، اجاره داده شده و بایگانی‌شده در سه فهرست مستقل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AdminOnly>{() => <ArchivePage />}</AdminOnly>,
});

/** Exact database count per status (head request, no rows). */
async function countStatus(status: PropertyStatus): Promise<number> {
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  if (error) throw error;
  return count ?? 0;
}

function ArchivePage() {
  const { tab = "sold" } = Route.useSearch();
  const navigate = useNavigate({ from: "/archive" });
  const queryClient = useQueryClient();
  const [queries, setQueries] = useState<Record<Tab, string>>({ sold: "", rented: "", archived: "" });
  const [pages, setPages] = useState<Record<Tab, number>>({ sold: 1, rented: 1, archived: 1 });

  const query = queries[tab];
  const page = pages[tab];
  const text = enDigits(query.trim());
  const fileCode = /^\d+$/.test(text) ? Number(text) : null;

  const { data: counts } = useQuery({
    queryKey: ["properties", "archive-counts"],
    queryFn: async () => {
      const [sold, rented, archived] = await Promise.all(TABS.map((t) => countStatus(t.key)));
      return { sold, rented, archived } as Record<Tab, number>;
    },
  });

  // Shared cached broker list; names are matched client-side, ids go to the DB.
  const brokersQuery = useQuery({ queryKey: ["brokers"], queryFn: fetchBrokers });
  const needle = fileCode === null ? normalizeFa(text) : "";
  const matchedAll = needle
    ? (brokersQuery.data ?? [])
        .filter((b) => {
          const name = normalizeFa(b.name ?? "");
          return (
            name.includes(needle) || name.replace(/ /g, "").includes(needle.replace(/ /g, ""))
          );
        })
        .map((b) => b.id)
        .sort()
    : [];
  const brokerLimitHit = matchedAll.length > MAX_BROKER_IDS;
  const matchedBrokerIds = matchedAll.slice(0, MAX_BROKER_IDS);
  // Wait for brokers before a text search so a broker-less first result is
  // never shown; if the broker list fails, property-field search still runs.
  const brokersPending = !!needle && brokersQuery.isPending;

  const { data, isLoading } = useQuery({
    queryKey: ["properties", "admin", "archive", tab, text, page, matchedBrokerIds],
    // Exactly one status per tab — the statuses never mix.
    queryFn: () =>
      fetchPropertiesPage(true, {
        status: tab,
        scope: "both",
        text,
        fileCode,
        page,
        pageSize: PAGE_SIZE,
        matchedBrokerIds,
      }),
    enabled: !brokersPending,
    placeholderData: (previous) => previous,
  });

  const reactivate = useMutation({
    // Same record: only its status changes; id, file code, owner and broker stay.
    mutationFn: (id: string) => restoreProperty(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("فایل دوباره فعال شد");
    },
    onError: () => toast.error("فعال‌سازی ناموفق بود"),
  });

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const setPage = (value: number) => setPages((prev) => ({ ...prev, [tab]: value }));

  return (
    <AppShell title="آرشیو" subtitle={`${faDigits(total)} فایل`}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => navigate({ search: { tab: t.key } })}
              className={`h-10 min-w-0 rounded-full border px-2 text-xs font-medium transition-colors ${
                tab === t.key
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              <span className="truncate">
                {t.label} {counts ? `(${faDigits(counts[t.key])})` : ""}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQueries((prev) => ({ ...prev, [tab]: value }));
              setPage(1);
            }}
            placeholder="جست‌وجو: کد فایل، مالک، تلفن، آدرس…"
            className="h-11 pe-9"
          />
        </div>

        {brokerLimitHit ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            بیش از {faDigits(MAX_BROKER_IDS)} دلال با این عبارت مطابقت دارند؛ فقط {faDigits(MAX_BROKER_IDS)} دلال اول
            در جست‌وجو لحاظ شد و ممکن است نتایج کامل نباشد. عبارت دقیق‌تری وارد کنید.
          </p>
        ) : null}

        {isLoading || brokersPending ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (data?.rows ?? []).length ? (
          <div className="space-y-3">
            {data!.rows.map((property) => (
              <div key={property.id} className="space-y-1.5">
                <PropertyCard property={property} />
                <Button
                  variant="secondary"
                  className="h-10 w-full"
                  disabled={reactivate.isPending}
                  onClick={() => reactivate.mutate(property.id)}
                >
                  <RotateCcw className="size-4" />
                  فعال‌سازی مجدد همین فایل
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="flex h-11 min-w-24 items-center justify-center gap-1 rounded-xl border border-border px-3 text-xs font-medium disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
                قبلی
              </button>
              <span className="text-[11px] text-muted-foreground">
                صفحه {faDigits(page)} از {faDigits(pageCount)}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(pageCount, page + 1))}
                disabled={page >= pageCount}
                className="flex h-11 min-w-24 items-center justify-center gap-1 rounded-xl border border-border px-3 text-xs font-medium disabled:opacity-40"
              >
                بعدی
                <ChevronLeft className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="surface-card p-6 text-center text-sm text-muted-foreground">
            فایلی در این بخش پیدا نشد.
          </p>
        )}
      </div>
    </AppShell>
  );
}
