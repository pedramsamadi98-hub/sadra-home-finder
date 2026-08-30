import { ChevronDown, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * Card section for the property detail page. `collapsible` keeps rarely used
 * blocks short while important information stays visible by default.
 */
export function SectionCard({
  icon: Icon,
  title,
  hint,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);

  return (
    <section className="surface-card overflow-hidden">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-11 w-full items-center gap-2 px-4 py-3 text-start"
        >
          <Icon className="size-4 shrink-0 text-primary" />
          <span className="text-sm font-bold">{title}</span>
          {hint ? (
            <span className="truncate text-[11px] text-muted-foreground">{hint}</span>
          ) : null}
          <ChevronDown
            className={`ms-auto size-4 shrink-0 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      ) : (
        <div className="flex items-center gap-2 px-4 pt-4">
          <Icon className="size-4 shrink-0 text-primary" />
          <h2 className="text-sm font-bold">{title}</h2>
          {hint ? (
            <span className="ms-auto truncate text-[11px] text-muted-foreground">{hint}</span>
          ) : null}
        </div>
      )}
      {open ? <div className="space-y-2 px-4 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}
