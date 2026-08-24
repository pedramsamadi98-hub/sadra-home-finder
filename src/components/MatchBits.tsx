import { Check, Minus, X } from "lucide-react";

import { faDigits } from "@/lib/fa";
import type { MatchCheck } from "@/lib/customers";

export function MatchScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "bg-success/15 text-success"
      : score >= 70
        ? "bg-primary/15 text-primary"
        : "bg-warning/15 text-warning";
  return (
    <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      {faDigits(score)}٪ تطابق
    </span>
  );
}

export function MatchChecks({ checks }: { checks: MatchCheck[] }) {
  const graded = checks.filter((c) => c.state !== "neutral");
  const neutral = checks.filter((c) => c.state === "neutral");
  return (
    <div className="space-y-1">
      {graded.map((check) => (
        <p
          key={check.label}
          className={`flex items-center gap-1.5 text-[11px] ${
            check.state === "ok" ? "text-success" : "text-destructive"
          }`}
        >
          {check.state === "ok" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
          {check.label}
        </p>
      ))}
      {neutral.length ? (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Minus className="mt-0.5 size-3.5 shrink-0" />
          {neutral.map((c) => c.label.replace(" (مهم نیست)", "").replace(" (فرقی ندارد)", "")).join(" • ")}: مهم نیست
        </p>
      ) : null}
    </div>
  );
}
