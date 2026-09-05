import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { faMoneyWords, formatMoneyText, groupDigits, parseNumber } from "@/lib/fa";

/**
 * Toman amount input: latin grouped digits while typing (decimals allowed) and
 * a readable Persian wording underneath so large numbers can never be misread.
 */
export function MoneyInput({
  label,
  value,
  onChange,
  placeholder,
  id,
  className,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [text, setText] = useState(() => groupDigits(value));

  // Keep in sync when the value is changed from outside (reset, edit, filters).
  useEffect(() => {
    if (parseNumber(text) !== value) setText(formatMoneyText(String(value ?? "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const words = faMoneyWords(parseNumber(text));
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        dir="ltr"
        inputMode="decimal"
        autoComplete="off"
        className="h-11 w-full text-left tabular-nums"
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          const next = formatMoneyText(event.target.value);
          setText(next);
          onChange(parseNumber(next));
        }}
      />
      <p className="min-h-4 break-words text-[11px] leading-4 text-primary/90">{words}</p>
    </div>
  );
}

/**
 * Same look and behaviour as MoneyInput but for string-backed values such as
 * the listing price filters (kept as strings because they live in the URL).
 */
export function MoneyFilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const words = faMoneyWords(parseNumber(value));
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        dir="ltr"
        inputMode="decimal"
        autoComplete="off"
        className="h-11 w-full text-left tabular-nums"
        placeholder={placeholder}
        value={formatMoneyText(value)}
        onChange={(event) => onChange(formatMoneyText(event.target.value))}
      />
      <p className="min-h-4 break-words text-[11px] leading-4 text-primary/90">{words}</p>
    </div>
  );
}
