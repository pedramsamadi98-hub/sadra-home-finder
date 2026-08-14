import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Building2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "ورود به سامانه املاک صدرا" },
      {
        name: "description",
        content: "ورود مشاور املاک به سامانه مدیریت فایل‌های ملکی شهر صدرای شیراز.",
      },
      { property: "og:title", content: "ورود به سامانه املاک صدرا" },
      {
        property: "og:description",
        content: "ورود مشاور املاک به سامانه مدیریت فایل‌های ملکی شهر صدرای شیراز.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.navigate({ to: "/" });
  }, [loading, user, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("خوش آمدید");
      router.navigate({ to: "/" });
    } catch {
      toast.error("ایمیل یا رمز عبور نادرست است");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="surface-card w-full max-w-sm space-y-5 p-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Building2 className="size-6" />
          </div>
          <h1 className="text-lg font-bold">سامانه املاک صدرا</h1>
          <p className="text-xs text-muted-foreground">
            دسترسی خصوصی — تنها برای مشاور این مجموعه
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">ایمیل</Label>
            <Input
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="text-left"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">رمز عبور</Label>
            <Input
              type="password"
              dir="ltr"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="text-left"
            />
          </div>
          <Button type="submit" disabled={busy} className="h-11 w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "ورود"}
          </Button>
        </form>

        <p className="text-center text-[11px] text-muted-foreground">
          ثبت‌نام غیرفعال است؛ فقط حساب شما به این سامانه دسترسی دارد.
        </p>
      </div>
    </div>
  );
}
