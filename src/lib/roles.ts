import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "collaborator";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدیر",
  collaborator: "همکار",
};

export interface Member {
  id: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  role: AppRole;
}

export async function fetchMyAccess(): Promise<{ role: AppRole | null; isActive: boolean }> {
  const [rolesRes, profileRes] = await Promise.all([
    supabase.from("user_roles").select("role"),
    supabase.from("profiles").select("is_active").maybeSingle(),
  ]);
  if (rolesRes.error) throw rolesRes.error;

  const roles = (rolesRes.data ?? []).map((row) => row.role as AppRole);
  const role: AppRole | null = roles.includes("admin")
    ? "admin"
    : roles.includes("collaborator")
      ? "collaborator"
      : null;

  return { role, isActive: profileRes.data?.is_active ?? true };
}

export function useRole() {
  const query = useQuery({
    queryKey: ["my-access"],
    queryFn: fetchMyAccess,
    staleTime: 60_000,
  });

  return {
    role: query.data?.role ?? null,
    isAdmin: query.data?.role === "admin",
    isCollaborator: query.data?.role === "collaborator",
    isActive: query.data?.isActive ?? true,
    loading: query.isLoading,
  };
}

export async function fetchMembers(): Promise<Member[]> {
  const [profiles, roles] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, is_active, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (profiles.error) throw profiles.error;
  if (roles.error) throw roles.error;

  const roleMap = new Map<string, AppRole>();
  for (const row of roles.data ?? []) {
    const current = roleMap.get(row.user_id);
    if (current === "admin") continue;
    roleMap.set(row.user_id, row.role as AppRole);
  }

  return (profiles.data ?? []).map((profile) => ({
    ...profile,
    role: roleMap.get(profile.id) ?? "collaborator",
  })) as Member[];
}

export async function setMemberActive(userId: string, isActive: boolean) {
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) throw error;
}

export async function setMemberRole(userId: string, role: AppRole) {
  const { error: delError } = await supabase.from("user_roles").delete().eq("user_id", userId);
  if (delError) throw delError;
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}
