import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { MoneyFilterInput } from "@/components/MoneyInput";
import { PropertyCard } from "@/components/PropertyCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchBrokers } from "@/lib/brokers";
import { enDigits, faDigits, parseNumber } from "@/lib/fa";
import {
  ALL_PROPERTY_TYPE_LABELS,
  ARCHIVE_SCOPE_LABELS,
  currentPrice,
  fetchPropertiesFor,
  matchesArchiveScope,
  needsPriceCheck,
  neighborhoodsFor,
  NEIGHBORHOODS,
  PHASES,
  OWNERSHIP_LABELS,
  propertyTypeLabel,
  STATUS_LABELS,
  TRANSACTION_LABELS,
  type ArchiveScope,
  type Property,
} from "@/lib/properties";
import { LAND_CATEGORIES, LAND_CATEGORY_LABELS, zonesFor } from "@/lib/land";
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

/**
 * The list view remembers search, filters and scroll position for the session,
 * so returning from a property's details lands exactly where the user left.
 */
const STATE_KEY = "listings-view-state";

type SavedState = Record<string, unknown>;

function readSaved(): SavedState {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(STATE_KEY) ?? "{}") as SavedState;
  } catch {
    return {};
  }
}

function Listings() {
  const { isAdmin, loading: roleLoading } = useRole();
  const { data, isLoading } = useQuery<Property[]>({
    queryKey: ["properties", isAdmin ? "admin" : "shared"],
    queryFn: () => fetchPropertiesFor(isAdmin),
    enabled: !roleLoading,
  });

  const saved = useRef<SavedState>(readSaved()).current;
  const pick = <T,>(key: string, fallback: T): T =>
    saved[key] === undefined ? fallback : (saved[key] as T);

  const [query, setQuery] = useState(pick("query", ""));
  const [showFilters, setShowFilters] = useState(pick("showFilters", false));
  // Multi-select usage types: an empty list means "همه" (no type restriction).
  const [types, setTypes] = useState<string[]>(() => {
    const savedTypes = saved["types"];
    if (Array.isArray(savedTypes)) return savedTypes.filter((v): v is string => typeof v === "string");
    const legacy = saved["type"];
    return typeof legacy === "string" && legacy !== ALL ? [legacy] : [];
  });
  const toggleType = (value: string) =>
    setTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  const [ownership, setOwnership] = useState<string>(pick("ownership", ALL));
  const [transaction, setTransaction] = useState<string>(pick("transaction", ALL));
  const [status, setStatus] = useState<string>(pick("status", "active"));
  // Archive scope: active files only (default), active + archive, or archive only.
  const [scope, setScope] = useState<ArchiveScope>(pick("scope", "active" as ArchiveScope));
  const [neighborhood, setNeighborhood] = useState<string>(pick("neighborhood", ALL));
  const [phase, setPhase] = useState<string>(pick("phase", ALL));
  const [landCategoryId, setLandCategoryId] = useState<string>(pick("landCategoryId", ALL));
  const [landZone, setLandZone] = useState<string>(pick("landZone", ALL));
  const [minArea, setMinArea] = useState(pick("minArea", ""));
  const [maxArea, setMaxArea] = useState(pick("maxArea", ""));
  const [minPrice, setMinPrice] = useState(pick("minPrice", ""));
  const [maxPrice, setMaxPrice] = useState(pick("maxPrice", ""));
  const [minBedrooms, setMinBedrooms] = useState(pick("minBedrooms", ""));
  const [parking, setParking] = useState(pick("parking", false));
  const [elevator, setElevator] = useState(pick("elevator", false));
  const [storageOnly, setStorageOnly] = useState(pick("storageOnly", false));
  const [broker, setBroker] = useState<string>(pick("broker", ALL));


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

    const codeQuery = /^\d+$/.test(q) ? Number(q) : null;

    const filtered = (data ?? []).filter((item) => {
      if (!matchesArchiveScope(item, scope)) return false;
      if (codeQuery !== null && item.file_code === codeQuery) return true;
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
            item.land_zone,
            item.plot_number,
            item.land_category ? LAND_CATEGORY_LABELS[item.land_category] : null,
            item.owner_name,
            item.owner_phone,
            item.description,
            item.notes,
            propertyTypeLabel(item.property_type),
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
      // Multi-select: OR across the chosen usage types, AND with every other filter.
      if (types.length && !types.includes(item.property_type)) return false;
      if (ownership !== ALL && item.ownership_type !== ownership) return false;
      if (transaction !== ALL && item.transaction_type !== transaction) return false;
      if (status !== ALL && item.status !== status) return false;
      if (neighborhood !== ALL && item.neighborhood !== neighborhood) return false;
      if (phase !== ALL && item.phase !== phase) return false;
      if (landCategoryId !== ALL && item.land_category !== landCategoryId) return false;
      if (landZone !== ALL && item.land_zone !== landZone) return false;
      if (parking && !item.parking) return false;
      if (elevator && !item.elevator) return false;
      if (storageOnly && !item.storage) return false;
      if (broker !== ALL) {
        if (broker === "none" ? item.broker_id !== null : item.broker_id !== broker) return false;
      }
      if (areaMin && (item.area ?? 0) < areaMin) return false;
      if (areaMax && (item.area ?? 0) > areaMax) return false;
      if (bedsMin && (item.bedrooms ?? 0) < bedsMin) return false;
      // Price filters run on the confirmed current price. A file whose price was
      // never re-confirmed stays visible as a «نیازمند استعلام» candidate instead
      // of being judged by an outdated amount.
      if (priceMin || priceMax) {
        if (item.transaction_type === "sale") {
          if (!needsPriceCheck(item)) {
            const priceValue = currentPrice(item) ?? 0;
            if (priceMin && priceValue < priceMin) return false;
            if (priceMax && priceValue > priceMax) return false;
          }
        } else {
          const priceValue = item.deposit ?? 0;
          if (priceMin && priceValue < priceMin) return false;
          if (priceMax && priceValue > priceMax) return false;
        }
      }
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
    types,
    ownership,
    transaction,
    status,
    scope,
    neighborhood,
    phase,
    landCategoryId,
    landZone,
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

  const view = {
    query,
    showFilters,
    types,
    ownership,
    transaction,
    status,
    neighborhood,
    phase,
    landCategoryId,
    landZone,
    minArea,
    maxArea,
    minPrice,
    maxPrice,
    minBedrooms,
    parking,
    elevator,
    storageOnly,
    broker,
    removed,
  };

  // Persist the current view (without touching scroll, saved separately).
  useEffect(() => {
    try {
      const prev = readSaved();
      window.sessionStorage.setItem(
        STATE_KEY,
        JSON.stringify({ ...prev, ...view }),
      );
    } catch {
      /* storage unavailable — filters simply won't persist */
    }
  }, [JSON.stringify(view)]);

  // Restore scroll every time the list is shown again, then keep tracking the
  // position so returning from a file's details lands in the same place.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    if (pathname.replace(/\/$/, "") !== "/listings" || isLoading || roleLoading || !results.length) return;
    const target = Number(readSaved()["scrollY"] ?? 0);

    // Debounced on purpose: the browser resets scroll to 0 right before leaving
    // the list, and that value must never be stored.
    let pending: number | undefined;
    const save = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => {
        try {
          window.sessionStorage.setItem(
            STATE_KEY,
            JSON.stringify({ ...readSaved(), scrollY: window.scrollY }),
          );
        } catch {
          /* storage unavailable — position simply won't persist */
        }
      }, 250);
    };

    let done = target <= 0;
    // The router restores scroll to the top asynchronously, so keep re-applying
    // the remembered offset for a short window unless the user scrolls first.
    const abort = () => {
      done = true;
    };
    if (!done) {
      window.addEventListener("wheel", abort, { passive: true, once: true });
      window.addEventListener("touchstart", abort, { passive: true, once: true });
    }
    const interval = window.setInterval(() => {
      if (done) return;
      if (Math.abs(window.scrollY - target) > 4) window.scrollTo({ top: target });
    }, 100);
    const settle = window.setTimeout(() => {
      done = true;
      window.clearInterval(interval);
      window.addEventListener("scroll", save, { passive: true });
    }, 2500);
    if (done) window.addEventListener("scroll", save, { passive: true });

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(settle);
      window.removeEventListener("wheel", abort);
      window.removeEventListener("touchstart", abort);
      window.clearTimeout(pending);
      window.removeEventListener("scroll", save);
    };
  }, [pathname, isLoading, roleLoading, results.length]);





  function reset() {
    setTypes([]);
    setOwnership(ALL);
    setTransaction(ALL);
    setStatus(ALL);
    setNeighborhood(ALL);
    setPhase(ALL);
    setLandCategoryId(ALL);
    setLandZone(ALL);
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
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              <Selector
                label="نوع ملک"
                value={ownership}
                onChange={setOwnership}
                options={OWNERSHIP_LABELS}
              />
              <div className="space-y-1.5 min-[400px]:col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">کاربری</Label>
                  <span className="text-[11px] text-muted-foreground">
                    {types.length ? `${faDigits(types.length)} مورد انتخاب شده` : "همه"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTypes([])}
                    className={`h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
                      types.length
                        ? "border-border text-muted-foreground"
                        : "border-primary bg-primary/15 text-primary"
                    }`}
                  >
                    همه
                  </button>
                  {Object.entries(ALL_PROPERTY_TYPE_LABELS).map(([key, text]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={types.includes(key)}
                      onClick={() => toggleType(key)}
                      className={`h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
                        types.includes(key)
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
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
                  onChange={(event) => {
                    setPhase(event.target.value);
                    setNeighborhood(ALL);
                  }}
                   className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
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
                   className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value={ALL}>همه</option>
                  {(phase === ALL
                    ? NEIGHBORHOODS.map((item) => ({ value: item, label: item }))
                    : neighborhoodsFor(phase)
                  ).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">دسته زمین</Label>
                <select
                  value={landCategoryId}
                  onChange={(event) => {
                    setLandCategoryId(event.target.value);
                    setLandZone(ALL);
                  }}
                   className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value={ALL}>همه</option>
                  {LAND_CATEGORIES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">محدوده</Label>
                <select
                  value={landZone}
                  onChange={(event) => setLandZone(event.target.value)}
                  disabled={landCategoryId === ALL || !zonesFor(landCategoryId).length}
                   className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-60"
                >
                  <option value={ALL}>همه</option>
                  {(landCategoryId === ALL ? [] : zonesFor(landCategoryId)).map((zone) => (
                    <option key={zone.label} value={zone.label}>
                      {zone.label}
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
                     className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
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
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              <TextFilter label="حداقل متراژ" value={minArea} onChange={setMinArea} />
              <TextFilter label="حداکثر متراژ" value={maxArea} onChange={setMaxArea} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MoneyFilterInput label="حداقل قیمت (تومان)" value={minPrice} onChange={setMinPrice} />
              <MoneyFilterInput label="حداکثر قیمت (تومان)" value={maxPrice} onChange={setMaxPrice} />
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
              className="h-11 w-full rounded-lg border border-border text-xs text-muted-foreground"
            >
              پاک کردن فیلترها
            </button>
          </div>
        ) : null}

        {isLoading || roleLoading ? (
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
        className="h-11 text-left"
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
      className={`h-11 rounded-xl border text-xs font-medium transition-colors ${
        active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}
