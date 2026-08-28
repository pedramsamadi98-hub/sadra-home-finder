import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, ScanText, Trash2, type LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { OcrReviewDialog } from "@/components/OcrReviewDialog";
import { usePhotoUrls } from "@/components/PhotoGallery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fetchBrokers } from "@/lib/brokers";
import { faPrice, parseNumber } from "@/lib/fa";
import { categoryOfZone, detectLand, zonesFor } from "@/lib/land";
import { extractPropertyFromImage, type OcrResult } from "@/lib/ocr.functions";
import {
  ALL_PROPERTY_TYPE_LABELS,
  CITIES,
  neighborhoodsFor,
  PHASES,
  OWNERSHIP_LABELS,
  PROPERTY_TYPE_LABELS,
  showsPlotNumber,
  STATUS_LABELS,
  TRANSACTION_LABELS,
  uploadPhotos,
  type OwnershipType,
  type PropertyInput,
  type PropertyStatus,
  type PropertyType,
  type TransactionType,
} from "@/lib/properties";


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card space-y-3 p-4">
      <h2 className="text-sm font-bold text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Chips<T extends string>({
  value,
  options,
  onChange,
  icons,
}: {
  value: T;
  options: Record<T, string>;
  onChange: (next: T) => void;
  icons?: Partial<Record<T, LucideIcon>>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(options) as T[]).map((key) => {
        const Icon = icons?.[key] as LucideIcon | undefined;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              value === key
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {Icon ? <Icon className="size-3.5" /> : null}
            {options[key]}
          </button>
        );
      })}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        inputMode="numeric"
        dir="ltr"
        value={value ?? ""}
        onChange={(event) => onChange(parseNumber(event.target.value))}
        className="text-left"
      />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function PropertyForm({
  initial,
  userId,
  submitLabel,
  onSubmit,
  submitting,
}: {
  initial: PropertyInput;
  userId: string;
  submitLabel: string;
  onSubmit: (input: PropertyInput) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<PropertyInput>(initial);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrOpen, setOcrOpen] = useState(false);
  const runOcr = useServerFn(extractPropertyFromImage);
  const { data: brokers } = useQuery({ queryKey: ["brokers"], queryFn: fetchBrokers });
  const { data: photoUrls } = usePhotoUrls(form.photos);
  const { data: privateUrls } = usePhotoUrls(form.private_photos);

  function set<K extends keyof PropertyInput>(key: K, value: PropertyInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const paths = await uploadPhotos(Array.from(files), userId, "public_listing");
      setForm((prev) => ({ ...prev, photos: [...prev.photos, ...paths] }));
      toast.success("عکس‌ها بارگذاری شد");
    } catch {
      toast.error("بارگذاری عکس ناموفق بود");
    } finally {
      setUploading(false);
    }
  }

  async function handleOcrFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });

      // Keep the source image attached, but as a PRIVATE OCR image (admin only).
      const [path] = await uploadPhotos([file], userId, "private_ocr");
      if (path) {
        setForm((prev) => ({ ...prev, private_photos: [...prev.private_photos, path] }));
      }

      const result = await runOcr({ data: { image: dataUrl } });

      // Match the read text against the official category/zone list. Anything
      // that is not a confident match stays empty for manual entry.
      const haystack = [
        result.land_text,
        result.title,
        result.neighborhood,
        result.street,
        result.address,
        result.description,
        result.notes,
        result.plot_number ? `پلاک ${result.plot_number}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      const detected = detectLand(haystack);

      setOcrResult({
        ...result,
        land_category: detected.land_category,
        land_zone: detected.land_zone,
        plot_number: result.plot_number ?? detected.plot_number,
      });
      setOcrOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("استخراج اطلاعات از عکس ناموفق بود");
    } finally {
      setScanning(false);
    }
  }

  function applyOcr(patch: Partial<PropertyInput>) {
    let applied = 0;
    setForm((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(patch)) {
        (next as Record<string, unknown>)[key] = value;
        applied += 1;
      }
      // Never keep a zone that does not belong to the selected category.
      if (next.land_zone && !next.land_category) {
        next.land_category = categoryOfZone(next.land_zone)?.id ?? null;
      }
      if (
        next.land_zone &&
        !zonesFor(next.land_category).some((zone) => zone.label === next.land_zone)
      ) {
        next.land_zone = null;
      }
      return next;
    });
    toast.success(`${applied} فیلد از عکس پر شد`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("عنوان ملک را وارد کنید");
      return;
    }
    if (!form.ownership_type) {
      toast.error("نوع ملک (ملکی یا اوقاف) را انتخاب کنید");
      return;
    }
    onSubmit(form);
  }

  const isRent = form.transaction_type === "rent" || form.transaction_type === "mortgage";

  // Legacy values (آپارتمان/زمین/…) stay selectable only while the file still
  // uses them, so old files keep their data when edited.
  const typeOptions = (
    form.property_type in PROPERTY_TYPE_LABELS
      ? PROPERTY_TYPE_LABELS
      : {
          ...PROPERTY_TYPE_LABELS,
          [form.property_type]: ALL_PROPERTY_TYPE_LABELS[form.property_type],
        }
  ) as Record<PropertyType, string>;
  const cityOptions = CITIES.includes(form.city) ? CITIES : [...CITIES, form.city];
  const phaseOptions = form.phase && !PHASES.includes(form.phase) ? [...PHASES, form.phase] : PHASES;
  const phaseNeighborhoods = neighborhoodsFor(form.phase);
  const neighborhoodOptions =
    form.neighborhood && !phaseNeighborhoods.some((item) => item.value === form.neighborhood)
      ? [...phaseNeighborhoods, { value: form.neighborhood, label: form.neighborhood }]
      : phaseNeighborhoods;
  const showPlot = showsPlotNumber(form.property_type, form.land_category);

  return (

    <form onSubmit={submit} className="space-y-4">
      <Section title="مشخصات کلی">
        <div className="space-y-1.5">
          <Label className="text-xs">عنوان ملک</Label>
          <Input
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="مثلاً آپارتمان ۱۲۰ متری فاز یک"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">نوع ملک (ملکی / اوقاف)</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(OWNERSHIP_LABELS) as OwnershipType[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => set("ownership_type", key)}
                className={`h-9 rounded-xl border px-4 text-xs font-medium transition-colors ${
                  form.ownership_type === key
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {OWNERSHIP_LABELS[key]}
              </button>
            ))}
          </div>
          {!form.ownership_type ? (
            <p className="text-[11px] text-destructive">
              انتخاب نوع ملک الزامی است.
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label className="text-xs">نوع کاربری ملک</Label>
          <Chips<PropertyType>
            value={form.property_type}
            options={typeOptions}
            onChange={(next) => set("property_type", next)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">نوع معامله</Label>
          <Chips<TransactionType>
            value={form.transaction_type}
            options={TRANSACTION_LABELS}
            onChange={(next) => set("transaction_type", next)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">وضعیت</Label>
          <Chips<PropertyStatus>
            value={form.status}
            options={STATUS_LABELS}
            onChange={(next) => set("status", next)}
          />
        </div>
      </Section>

      <Section title="موقعیت">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">شهر</Label>
            <select
              value={form.city}
              onChange={(event) => set("city", event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {cityOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">فاز</Label>
            <select
              value={form.phase ?? ""}
              onChange={(event) => {
                const nextPhase = event.target.value;
                setForm((prev) => {
                  const allowed = neighborhoodsFor(nextPhase).map((item) => item.value);
                  return {
                    ...prev,
                    phase: nextPhase,
                    neighborhood:
                      prev.neighborhood && allowed.includes(prev.neighborhood)
                        ? prev.neighborhood
                        : "",
                  };
                });
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">انتخاب کنید</option>
              {phaseOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">محله</Label>
          <select
            value={form.neighborhood ?? ""}
            onChange={(event) => set("neighborhood", event.target.value)}
            disabled={!neighborhoodOptions.length}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
          >
            <option value="">بدون محله</option>
            {neighborhoodOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {!form.phase ? (
            <p className="text-[11px] text-muted-foreground">
              اول فاز را انتخاب کنید تا محله‌های همان فاز نمایش داده شود.
            </p>
          ) : !neighborhoodsFor(form.phase).length ? (
            <p className="text-[11px] text-muted-foreground">
              برای این فاز فعلاً محله‌ای تعریف نشده است.
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">خیابان</Label>
            <Input
              value={form.street ?? ""}
              onChange={(event) => set("street", event.target.value)}
              placeholder="نام خیابان / بلوار"
            />
          </div>
          {showPlot ? (
            <div className="space-y-1.5">
              <Label className="text-xs">پلاک (اختیاری)</Label>
              <Input
                value={form.plot_number ?? ""}
                onChange={(event) => set("plot_number", event.target.value)}
                placeholder="مثلاً ۲۲ یا ۲۲/الف"
              />
            </div>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">آدرس</Label>
          <Input
            value={form.address ?? ""}
            onChange={(event) => set("address", event.target.value)}
            placeholder="بلوار، کوچه، پلاک"
          />
        </div>
      </Section>


      <Section title="قیمت و متراژ">
        <NumberField
          label="متراژ (متر مربع)"
          value={form.area}
          onChange={(next) => set("area", next)}
        />
        {isRent ? (
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="رهن / ودیعه (تومان)"
              value={form.deposit}
              onChange={(next) => set("deposit", next)}
              hint={faPrice(form.deposit)}
            />
            <NumberField
              label="اجاره ماهانه (تومان)"
              value={form.monthly_rent}
              onChange={(next) => set("monthly_rent", next)}
              hint={faPrice(form.monthly_rent)}
            />
          </div>
        ) : (
          <NumberField
            label="قیمت کل (تومان)"
            value={form.price}
            onChange={(next) => set("price", next)}
            hint={faPrice(form.price)}
          />
        )}
      </Section>

      <Section title="جزئیات ساختمان">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="خواب"
            value={form.bedrooms}
            onChange={(next) => set("bedrooms", next)}
          />
          <NumberField label="طبقه" value={form.floor} onChange={(next) => set("floor", next)} />
          <NumberField
            label="کل طبقات"
            value={form.total_floors}
            onChange={(next) => set("total_floors", next)}
          />
          <NumberField
            label="سن بنا"
            value={form.building_age}
            onChange={(next) => set("building_age", next)}
          />
        </div>
        <div className="grid gap-2">
          <ToggleRow
            label="پارکینگ"
            checked={form.parking}
            onChange={(next) => set("parking", next)}
          />
          <ToggleRow
            label="آسانسور"
            checked={form.elevator}
            onChange={(next) => set("elevator", next)}
          />
          <ToggleRow
            label="انباری"
            checked={form.storage}
            onChange={(next) => set("storage", next)}
          />
        </div>
      </Section>

      <Section title="تصاویر ملک">
        <label
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary/10 py-3.5 text-sm font-bold text-primary ${
            scanning ? "pointer-events-none opacity-70" : ""
          }`}
        >
          {scanning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ScanText className="size-4" />
          )}
          {scanning ? "در حال خواندن عکس…" : "استخراج اطلاعات از عکس"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={scanning}
            onChange={(event) => {
              void handleOcrFile(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        <p className="text-[11px] text-muted-foreground">
          عکس برگه یا فایل ملکی (دست‌نویس یا تایپی) را انتخاب کنید؛ اطلاعات خوانده‌شده را
          قبل از درج در فرم بازبینی می‌کنید. این عکس به‌عنوان «تصویر خصوصی / OCR» ذخیره
          می‌شود و فقط برای مدیر قابل مشاهده است.
        </p>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-6 text-sm text-muted-foreground">
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          {uploading ? "در حال بارگذاری…" : "افزودن عکس"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
        </label>
        {form.photos.length ? (
          <div className="grid grid-cols-3 gap-2">
            {form.photos.map((path, index) => (
              <div key={path} className="relative overflow-hidden rounded-xl">
                {photoUrls?.[index] ? (
                  <img
                    src={photoUrls[index]}
                    alt={`تصویر ${index + 1}`}
                    className="h-24 w-full object-cover"
                  />
                ) : (
                  <div className="h-24 w-full animate-pulse bg-secondary" />
                )}
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "photos",
                      form.photos.filter((item) => item !== path),
                    )
                  }
                  className="absolute end-1 top-1 rounded-md bg-background/85 p-1 text-destructive"
                  aria-label="حذف عکس"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {form.private_photos.length ? (
          <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-xs font-bold text-destructive">
              تصاویر خصوصی / OCR — فقط مدیر
            </p>
            <div className="grid grid-cols-3 gap-2">
              {form.private_photos.map((path, index) => (
                <div key={path} className="relative overflow-hidden rounded-xl">
                  {privateUrls?.[index] ? (
                    <img
                      src={privateUrls[index]}
                      alt={`تصویر خصوصی ${index + 1}`}
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="h-24 w-full animate-pulse bg-secondary" />
                  )}
                  <span className="absolute bottom-1 start-1 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                    خصوصی
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "private_photos",
                        form.private_photos.filter((item) => item !== path),
                      )
                    }
                    className="absolute end-1 top-1 rounded-md bg-background/85 p-1 text-destructive"
                    aria-label="حذف تصویر خصوصی"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="دلال / منبع فایل">
        <div className="space-y-1.5">
          <Label className="text-xs">این فایل از طرف کدام دلال است؟</Label>
          <select
            value={form.broker_id ?? ""}
            onChange={(event) => set("broker_id", event.target.value || null)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">فایل شخصی (بدون دلال)</option>
            {(brokers ?? []).map((broker) => (
              <option key={broker.id} value={broker.id}>
                {broker.name}
                {broker.agency ? ` — ${broker.agency}` : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            دلال‌ها را از بخش «دلال‌ها» اضافه کنید.
          </p>
        </div>
      </Section>

      <Section title="مالک و توضیحات">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">نام مالک</Label>
            <Input
              value={form.owner_name ?? ""}
              onChange={(event) => set("owner_name", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">شماره تماس</Label>
            <Input
              dir="ltr"
              inputMode="tel"
              className="text-left"
              value={form.owner_phone ?? ""}
              onChange={(event) => set("owner_phone", event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">توضیحات</Label>
          <Textarea
            rows={3}
            value={form.description ?? ""}
            onChange={(event) => set("description", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">یادداشت داخلی</Label>
          <Textarea
            rows={2}
            value={form.notes ?? ""}
            onChange={(event) => set("notes", event.target.value)}
          />
        </div>
      </Section>

      <Button type="submit" disabled={submitting} className="h-12 w-full text-base">
        {submitting ? <Loader2 className="size-4 animate-spin" /> : submitLabel}
      </Button>

      <OcrReviewDialog
        open={ocrOpen}
        result={ocrResult}
        onOpenChange={setOcrOpen}
        onConfirm={applyOcr}
      />
    </form>
  );
}
