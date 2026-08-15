import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PropertyCard } from "@/components/PropertyCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchBrokers } from "@/lib/brokers";
import { enDigits, faDigits, parseNumber } from "@/lib/fa";
import {
  fetchProperties,
  NEIGHBORHOODS,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  TRANSACTION_LABELS,
  type Property,
} from "@/lib/properties";

export const Route = createFileRoute("/listings/")({
  head: () => ({
    meta: [
      { title: "فهرست املاک صدرا | جست‌وجو و فیلتر فایل‌ها" },
      {
        name: "description",
        content:
          "جست‌وجوی سریع و فیلتر فایل‌های ملکی صدرا بر اساس نوع ملک، فروش یا اجاره، محله، متراژ، قیمت و تعداد خواب.",
      },
      { property: "og:title", content: "فهرست املاک صدرا" },
      {
        property: "og:description",
        content: "جست‌وجو و فیلتر فایل‌های ملکی شهر صدرا در چند ثانیه.",
      },
    ],
  }),
  component: ListingsRoute,
});

function ListingsRoute() {
  return <AuthGate>{() => <Listings />}</AuthGate>;
}

const ALL = "all";

function Listings() {
  const { data, isLoading } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: fetchProperties,
  });

  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [type, setType] = useState<string>(ALL);
  const [transaction, setTransaction] = useState<string>(ALL);
  const [status, setStatus] = useState<string>("active");
  const [neighborhood, setNeighborhood] = useState<string>(ALL);
  const [minArea, setMinArea] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("");
  const [broker, setBroker] = useState<string>(ALL);

  const { data: brokers } = useQuery({ queryKey: ["brokers"], queryFn: fetchBrokers });

  const results = useMemo(() => {
    const q = enDigits(query.trim().toLowerCase());
    const areaMin = parseNumber(minArea);
    const priceMax = parseNumber(maxPrice);
    const bedsMin = parseNumber(minBedrooms);

    return (data ?? []).filter((item) => {
      if (q) {
        const haystack = [
          item.title,
          item.neighborhood,
          item.address,
          item.owner_name,
          item.owner_phone,
          item.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (type !== ALL && item.property_type !== type) return false;
      if (transaction !== ALL && item.transaction_type !== transaction) return false;
      if (status !== ALL && item.status !== status) return false;
      if (neighborhood !== ALL && item.neighborhood !== neighborhood) return false;
      if (broker !== ALL) {
        if (broker === "none" ? item.broker_id !== null : item.broker_id !== broker) return false;
      }
      if (areaMin && (item.area ?? 0) < areaMin) return false;
      if (bedsMin && (item.bedrooms ?? 0) < bedsMin) return false;
      if (priceMax) {
        const value =
          item.transaction_type === "rent" ? (item.deposit ?? 0) : (item.price ?? 0);
        if (value > priceMax) return false;
      }
      return true;
    });
  }, [
    data,
    query,
    type,
    transaction,
    status,
    neighborhood,
    broker,
    minArea,
    maxPrice,
    minBedrooms,
  ]);

  function reset() {
    setType(ALL);
    setTransaction(ALL);
    setStatus(ALL);
    setNeighborhood(ALL);
    setBroker(ALL);
    setMinArea("");
    setMaxPrice("");
    setMinBedrooms("");
  }

  return (
    <AppShell title="املاک" subtitle={`${faDigits(results.length)} فایل یافت شد`}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجو در عنوان، محله، مالک…"
              className="h-11 pe-9"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className={`flex size-11 shrink-0 items-center justify-center rounded-md border transition-colors ${
              showFilters ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
            aria-label="فیلترها"
          >
            {showFilters ? <X className="size-4" /> : <SlidersHorizontal className="size-4" />}
          </button>
        </div>

        {showFilters ? (
          <div className="surface-card space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Selector
                label="نوع ملک"
                value={type}
                onChange={setType}
                options={PROPERTY_TYPE_LABELS}
              />
              <Selector
                label="معامله"
                value={transaction}
                onChange={setTransaction}
                options={TRANSACTION_LABELS}
              />
              <Selector
                label="وضعیت"
                value={status}
                onChange={setStatus}
                options={STATUS_LABELS}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">محله</Label>
                <select
                  value={neighborhood}
                  onChange={(event) => setNeighborhood(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value={ALL}>همه</option>
                  {NEIGHBORHOODS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">دلال</Label>
                <select
                  value={broker}
                  onChange={(event) => setBroker(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value={ALL}>همه</option>
                  <option value="none">بدون دلال</option>
                  {(brokers ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <TextFilter label="حداقل متراژ" value={minArea} onChange={setMinArea} />
              <TextFilter label="حداکثر قیمت" value={maxPrice} onChange={setMaxPrice} />
              <TextFilter label="حداقل خواب" value={minBedrooms} onChange={setMinBedrooms} />
            </div>
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-md border border-border py-2 text-xs text-muted-foreground"
            >
              پاک کردن فیلترها
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
            {!results.length ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                فایلی با این مشخصات پیدا نشد.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Selector({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Record<string, string>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value={ALL}>همه</option>
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px]">{label}</Label>
      <Input
        dir="ltr"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 text-left"
      />
    </div>
  );
}
