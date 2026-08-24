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
  fetchPropertiesFor,
  NEIGHBORHOODS,
  PHASES,
  OWNERSHIP_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  TRANSACTION_LABELS,
  type Property,
} from "@/lib/properties";
import { useRole } from "@/lib/roles";
import { matchesCriteria, parseSmartQuery, relevanceScore } from "@/lib/smart-search";

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
  const { isAdmin, loading: roleLoading } = useRole();
  const { data, isLoading } = useQuery<Property[]>({
    queryKey: ["properties", isAdmin ? "admin" : "shared"],
    queryFn: () => fetchPropertiesFor(isAdmin),
    enabled: !roleLoading,
  });

  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [type, setType] = useState<string>(ALL);
  const [ownership, setOwnership] = useState<string>(ALL);
  const [transaction, setTransaction] = useState<string>(ALL);
  const [status, setStatus] = useState<string>("active");
  const [neighborhood, setNeighborhood] = useState<string>(ALL);
  const [phase, setPhase] = useState<string>(ALL);
  const [minArea, setMinArea] = useState("");
  const [maxArea, setMaxArea] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("");
  const [parking, setParking] = useState(false);
  const [elevator, setElevator] = useState(false);
  const [storageOnly, setStorageOnly] = useState(false);
  const [broker, setBroker] = useState<string>(ALL);

  const { data: brokers } = useQuery({
    queryKey: ["brokers"],
    queryFn: fetchBrokers,
    enabled: isAdmin,
  });

  const [removed, setRemoved] = useState<string[]>([]);

  const parsed = useMemo(() => parseSmartQuery(query), [query]);
  const criteria = useMemo(
    () => parsed.criteria.filter((item) => !removed.includes(item.id)),
    [parsed, removed],
  );

  const results = useMemo(() => {
    const textQuery = criteria.length ? parsed.rest : query.trim();
    const q = enDigits(textQuery.toLowerCase());
    const areaMin = parseNumber(minArea);
    const areaMax = parseNumber(maxArea);
    const priceMin = parseNumber(minPrice);
    const priceMax = parseNumber(maxPrice);
    const bedsMin = parseNumber(minBedrooms);

    const filtered = (data ?? []).filter((item) => {
      if (!matchesCriteria(item, criteria)) return false;
      if (q) {
        const haystack = enDigits(
          [
            item.title,
            item.city,
            item.phase,
            item.neighborhood,
            item.street,
            item.address,
            item.owner_name,
            item.owner_phone,
            item.description,
            item.notes,
            PROPERTY_TYPE_LABELS[item.property_type],
            TRANSACTION_LABELS[item.transaction_type],
            STATUS_LABELS[item.status],
            item.ownership_type ? OWNERSHIP_LABELS[item.ownership_type] : null,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        );
        if (!haystack.includes(q)) return false;
      }
      if (type !== ALL && item.property_type !== type) return false;
      if (ownership !== ALL && item.ownership_type !== ownership) return false;
      if (transaction !== ALL && item.transaction_type !== transaction) return false;
      if (status !== ALL && item.status !== status) return false;
      if (neighborhood !== ALL && item.neighborhood !== neighborhood) return false;
      if (phase !== ALL && item.phase !== phase) return false;
      if (parking && !item.parking) return false;
      if (elevator && !item.elevator) return false;
      if (storageOnly && !item.storage) return false;
      if (broker !== ALL) {
        if (broker === "none" ? item.broker_id !== null : item.broker_id !== broker) return false;
      }
      if (areaMin && (item.area ?? 0) < areaMin) return false;
      if (areaMax && (item.area ?? 0) > areaMax) return false;
      if (bedsMin && (item.bedrooms ?? 0) < bedsMin) return false;
      const priceValue =
        item.transaction_type === "sale" ? (item.price ?? 0) : (item.deposit ?? 0);
      if (priceMin && priceValue < priceMin) return false;
      if (priceMax && priceValue > priceMax) return false;
      return true;
    });

    if (!criteria.length && !textQuery) return filtered;
    return [...filtered].sort(
      (a, b) =>
        relevanceScore(b, criteria, textQuery) - relevanceScore(a, criteria, textQuery),
    );
  }, [
    data,
    query,
    parsed,
    criteria,
    type,
    ownership,
    transaction,
    status,
    neighborhood,
    phase,
    broker,
    minArea,
    maxArea,
    minPrice,
    maxPrice,
    minBedrooms,
    parking,
    elevator,
    storageOnly,
  ]);


  function reset() {
    setType(ALL);
    setOwnership(ALL);
    setTransaction(ALL);
    setStatus(ALL);
    setNeighborhood(ALL);
    setPhase(ALL);
    setBroker(ALL);
    setMinArea("");
    setMaxArea("");
    setMinPrice("");
    setMaxPrice("");
    setMinBedrooms("");
    setParking(false);
    setElevator(false);
    setStorageOnly(false);
  }

  return (
    <AppShell title="املاک" subtitle={`${faDigits(results.length)} فایل یافت شد`}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setRemoved([]);
              }}
              placeholder="مثلاً: آپارتمان ۳ خواب فاز ۲ بین ۱۲۰ تا ۱۵۰ متر تا ۱۲ میلیارد"
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

        {criteria.length ? (
          <div className="flex flex-wrap gap-2">
            {criteria.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRemoved((prev) => [...prev, item.id])}
                className="flex items-center gap-1 rounded-full border border-primary bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary"
              >
                {item.label}
                <X className="size-3" />
              </button>
            ))}
          </div>
        ) : null}


        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[
            { key: "active", label: "فعال" },
            { key: "sold", label: "فروش رفته" },
            { key: "rented", label: "اجاره داده شده" },
            { key: "archived", label: "بایگانی" },
            { key: ALL, label: "همه" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatus(tab.key)}
              className={`h-9 shrink-0 rounded-full border px-4 text-xs font-medium transition-colors ${
                status === tab.key
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {showFilters ? (
          <div className="surface-card space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Selector
                label="نوع ملک"
                value={ownership}
                onChange={setOwnership}
                options={OWNERSHIP_LABELS}
              />
              <Selector
                label="کاربری"
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
                <Label className="text-xs">فاز</Label>
                <select
                  value={phase}
                  onChange={(event) => setPhase(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value={ALL}>همه</option>
                  {PHASES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
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
              {isAdmin ? (
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
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextFilter label="حداقل متراژ" value={minArea} onChange={setMinArea} />
              <TextFilter label="حداکثر متراژ" value={maxArea} onChange={setMaxArea} />
              <TextFilter label="حداقل قیمت" value={minPrice} onChange={setMinPrice} />
              <TextFilter label="حداکثر قیمت" value={maxPrice} onChange={setMaxPrice} />
            </div>
            <TextFilter label="حداقل خواب" value={minBedrooms} onChange={setMinBedrooms} />
            <div className="grid grid-cols-3 gap-2">
              <ToggleChip label="پارکینگ" active={parking} onToggle={() => setParking((v) => !v)} />
              <ToggleChip label="آسانسور" active={elevator} onToggle={() => setElevator((v) => !v)} />
              <ToggleChip
                label="انباری"
                active={storageOnly}
                onToggle={() => setStorageOnly((v) => !v)}
              />
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
              <div className="space-y-2 py-12 text-center">
                <p className="text-sm text-muted-foreground">فایلی مطابق این جستجو پیدا نشد.</p>
                <p className="text-xs text-muted-foreground">
                  چند فیلتر را حذف کنید یا محدوده متراژ و قیمت را بازتر کنید.
                </p>
              </div>
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

function ToggleChip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`h-10 rounded-xl border text-xs font-medium transition-colors ${
        active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}
