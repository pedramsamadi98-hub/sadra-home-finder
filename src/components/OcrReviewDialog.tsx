import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { faDigits, parseNumber } from "@/lib/fa";
import type { OcrResult } from "@/lib/ocr.functions";
import {
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  TRANSACTION_LABELS,
  type PropertyInput,
} from "@/lib/properties";

type Kind = "text" | "long" | "number" | "bool" | "type" | "transaction";

const FIELDS: { key: keyof OcrResult; label: string; kind: Kind }[] = [
  { key: "title", label: "عنوان ملک", kind: "text" },
  { key: "property_type", label: "نوع ملک", kind: "type" },
  { key: "transaction_type", label: "نوع معامله", kind: "transaction" },
  { key: "city", label: "شهر", kind: "text" },
  { key: "phase", label: "فاز", kind: "text" },
  { key: "neighborhood", label: "محله", kind: "text" },
  { key: "street", label: "خیابان", kind: "text" },
  { key: "address", label: "آدرس", kind: "text" },
  { key: "area", label: "متراژ", kind: "number" },
  { key: "price", label: "قیمت", kind: "number" },
  { key: "deposit", label: "مبلغ رهن", kind: "number" },
  { key: "monthly_rent", label: "مبلغ اجاره", kind: "number" },
  { key: "bedrooms", label: "تعداد خواب", kind: "number" },
  { key: "floor", label: "طبقه", kind: "number" },
  { key: "total_floors", label: "تعداد طبقات", kind: "number" },
  { key: "building_age", label: "سن بنا", kind: "number" },
  { key: "parking", label: "پارکینگ", kind: "bool" },
  { key: "elevator", label: "آسانسور", kind: "bool" },
  { key: "storage", label: "انباری", kind: "bool" },
  { key: "owner_name", label: "نام مالک", kind: "text" },
  { key: "owner_phone", label: "شماره تماس مالک", kind: "text" },
  { key: "description", label: "توضیحات", kind: "long" },
  { key: "notes", label: "یادداشت داخلی", kind: "long" },
];

interface Row {
  key: keyof OcrResult;
  label: string;
  kind: Kind;
  value: string;
  accepted: boolean;
}

function isFilled(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function OcrReviewDialog({
  open,
  result,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  result: OcrResult | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (patch: Partial<PropertyInput>) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!result) {
      setRows([]);
      return;
    }
    setRows(
      FIELDS.filter((field) => isFilled(result[field.key])).map((field) => {
        const raw = result[field.key];
        return {
          ...field,
          value:
            field.kind === "bool" ? (raw ? "true" : "false") : String(raw ?? ""),
          accepted: true,
        };
      }),
    );
  }, [result]);

  const missing = result
    ? FIELDS.filter((field) => !isFilled(result[field.key]))
    : [];

  function update(key: keyof OcrResult, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function confirm() {
    const patch: Record<string, unknown> = {};
    for (const row of rows) {
      if (!row.accepted) continue;
      if (row.kind === "number") {
        const parsed = parseNumber(row.value);
        if (parsed !== null) patch[row.key] = parsed;
      } else if (row.kind === "bool") {
        patch[row.key] = row.value === "true";
      } else if (row.kind === "type") {
        if (row.value in PROPERTY_TYPE_LABELS) patch[row.key] = row.value;
      } else if (row.kind === "transaction") {
        if (row.value in TRANSACTION_LABELS) patch[row.key] = row.value;
      } else if (row.value.trim()) {
        patch[row.key] = row.value.trim();
      }
    }
    onConfirm(patch as Partial<PropertyInput>);
    onOpenChange(false);
  }

  const acceptedCount = rows.filter((row) => row.accepted).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[88vh] max-w-lg overflow-y-auto text-right"
      >
        <DialogHeader className="text-right">
          <DialogTitle>بازبینی اطلاعات استخراج‌شده</DialogTitle>
          <DialogDescription>
            مقدارها را بررسی، ویرایش یا نادیده بگیرید. فقط موارد تأییدشده در فرم قرار
            می‌گیرند.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
            هیچ اطلاعاتی با اطمینان از تصویر خوانده نشد. لطفاً فیلدها را دستی وارد کنید.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.key}
                className={`rounded-xl border p-3 transition-colors ${
                  row.accepted ? "border-primary/40 bg-primary/5" : "border-border opacity-60"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label className="text-xs font-bold">{row.label}</Label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => update(row.key, { accepted: true })}
                      aria-label={`تأیید ${row.label}`}
                      className={`rounded-md p-1.5 ${
                        row.accepted ? "bg-primary/20 text-primary" : "text-muted-foreground"
                      }`}
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => update(row.key, { accepted: false })}
                      aria-label={`نادیده گرفتن ${row.label}`}
                      className={`rounded-md p-1.5 ${
                        row.accepted ? "text-muted-foreground" : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                {row.kind === "bool" ? (
                  <div className="flex gap-2">
                    {[
                      { key: "true", label: "دارد" },
                      { key: "false", label: "ندارد" },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => update(row.key, { value: option.key })}
                        className={`rounded-full border px-3 py-1.5 text-xs ${
                          row.value === option.key
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : row.kind === "type" || row.kind === "transaction" ? (
                  <select
                    value={row.value}
                    onChange={(event) => update(row.key, { value: event.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(
                      row.kind === "type" ? PROPERTY_TYPE_LABELS : TRANSACTION_LABELS,
                    ).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : row.kind === "long" ? (
                  <Textarea
                    rows={2}
                    value={row.value}
                    onChange={(event) => update(row.key, { value: event.target.value })}
                  />
                ) : (
                  <>
                    <Input
                      dir={row.kind === "number" ? "ltr" : "rtl"}
                      inputMode={row.kind === "number" ? "numeric" : "text"}
                      className={row.kind === "number" ? "text-left" : ""}
                      value={row.value}
                      onChange={(event) => update(row.key, { value: event.target.value })}
                    />
                    {row.kind === "number" ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {faDigits(Number(parseNumber(row.value) ?? 0).toLocaleString("en-US"))}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {missing.length ? (
          <div className="rounded-xl border border-dashed border-border p-3">
            <p className="mb-1 text-xs font-bold text-muted-foreground">
              خوانده نشد — نیاز به ورود دستی:
            </p>
            <p className="text-[11px] leading-6 text-muted-foreground">
              {missing.map((field) => field.label).join("، ")}
            </p>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            onClick={confirm}
            disabled={acceptedCount === 0}
            className="h-11 w-full sm:w-auto"
          >
            درج {faDigits(acceptedCount)} مورد در فرم
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full sm:w-auto"
          >
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { STATUS_LABELS };
