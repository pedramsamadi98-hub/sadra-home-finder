import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { useRole } from "@/lib/roles";

/**
 * Renders children only for admins. This is a UX guard; the real protection
 * lives in database policies (collaborators simply have no access to the
 * private rows/columns behind these screens).
 */
export function AdminOnly({ children }: { children: (userId: string) => ReactNode }) {
  return (
    <AuthGate>
      {(userId) => <Inner userId={userId}>{children}</Inner>}
    </AuthGate>
  );
}

function Inner({
  userId,
  children,
}: {
  userId: string;
  children: (userId: string) => ReactNode;
}) {
  const { isAdmin, loading } = useRole();

  if (loading) {
    return (
      <AppShell title="در حال بارگذاری">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="دسترسی محدود">
        <div className="surface-card space-y-3 p-6 text-center">
          <ShieldAlert className="mx-auto size-8 text-warning" />
          <p className="text-sm font-semibold">این بخش فقط برای مدیر سیستم است.</p>
          <p className="text-xs text-muted-foreground">
            شما به‌عنوان همکار وارد شده‌اید و می‌توانید فایل‌های ملکی را جست‌وجو و مشاهده کنید.
          </p>
          <Link to="/listings" className="inline-block text-xs font-semibold text-primary">
            رفتن به فهرست املاک
          </Link>
        </div>
      </AppShell>
    );
  }

  return <>{children(userId)}</>;
}
