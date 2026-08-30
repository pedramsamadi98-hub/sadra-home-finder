import { Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Consistent inline loading state. */
export function LoadingBlock({ label = "در حال بارگذاری…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-2 py-14"
    >
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Consistent empty state with an optional call to action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center gap-2 px-4 py-8 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-bold">{title}</p>
      {description ? (
        <p className="max-w-xs text-xs leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-1 w-full max-w-xs">{action}</div> : null}
    </div>
  );
}

/** Consistent error state. */
export function ErrorBlock({
  title = "خطا در دریافت اطلاعات",
  description = "اتصال خود را بررسی کنید و دوباره تلاش کنید.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="surface-card flex flex-col items-center gap-2 px-4 py-8 text-center"
    >
      <p className="text-sm font-bold text-destructive">{title}</p>
      <p className="max-w-xs text-xs leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-1 w-full max-w-xs">{action}</div> : null}
    </div>
  );
}
