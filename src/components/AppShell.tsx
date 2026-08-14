import { Link, useRouter } from "@tanstack/react-router";
import { Building2, LayoutDashboard, List, Moon, Plus, Sun, LogOut, Users } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/", label: "داشبورد", icon: LayoutDashboard },
  { to: "/listings", label: "املاک", icon: List },
  { to: "/brokers", label: "دلال‌ها", icon: Users },
  { to: "/listings/new", label: "ثبت ملک", icon: Plus },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("از حساب خارج شدید");
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{title}</h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {action}
          <button
            type="button"
            onClick={toggle}
            aria-label="تغییر پوسته"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button
            type="button"
            onClick={signOut}
            aria-label="خروج"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 py-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs text-muted-foreground transition-colors"
              activeProps={{ className: "!text-primary bg-primary/10 font-semibold" }}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
