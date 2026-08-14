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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("حساب ساخته شد");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("خوش آمدید");
      }
      router.navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطا در ورود");
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
            مدیریت فایل‌های ملکی شهر صدرا، شیراز
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
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === "signin" ? (
              "ورود"
            ) : (
              "ساخت حساب"
            )}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "signin" ? "حساب ندارید؟ ثبت‌نام کنید" : "حساب دارید؟ وارد شوید"}
        </button>
      </div>
    </div>
  );
}
