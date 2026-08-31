import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { faMoneyWords, groupDigits, parseNumber } from "@/lib/fa";

/**
 * Toman amount input: latin grouped digits while typing and a readable
 * Persian wording underneath so large numbers can never be misread.
 */
export function MoneyInput({
  label,
  value,
  onChange,
  placeholder,
  id,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  id?: string;
}) {
  const words = faMoneyWords(value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        className="h-11 text-left tabular-nums"
        placeholder={placeholder}
        value={groupDigits(value)}
        onChange={(event) => onChange(parseNumber(event.target.value))}
      />
      <p className="min-h-4 text-[11px] leading-4 text-primary/90">{words}</p>
    </div>
  );
}
