import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabaseClient: {
  from: (table: "user_roles") => {
    select: (cols: string) => { eq: (col: string, value: string) => Promise<{ data: unknown }> };
  };
}, userId: string) {
  const { data } = await supabaseClient.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []) as Array<{ role: string }>;
  if (!roles.some((row) => row.role === "admin")) {
    throw new Error("دسترسی مدیر لازم است");
  }
}

export const createCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; password: string; fullName?: string; role?: string }) => {
    const email = String(data?.email ?? "").trim().toLowerCase();
    const password = String(data?.password ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("ایمیل معتبر نیست");
    if (password.length < 8) throw new Error("رمز عبور باید حداقل ۸ کاراکتر باشد");
    const role = data?.role === "admin" ? "admin" : "collaborator";
    return { email, password, fullName: String(data?.fullName ?? "").trim(), role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName || data.email },
    });
    if (error || !created.user) throw new Error(error?.message ?? "ایجاد کاربر ناموفق بود");

    const userId = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email: data.email, full_name: data.fullName || data.email });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role as "admin" | "collaborator" });

    return { id: userId };
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    const userId = String(data?.userId ?? "");
    if (!userId) throw new Error("شناسه کاربر لازم است");
    return { userId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId) throw new Error("حذف حساب خودتان امکان‌پذیر نیست");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
