type MinimalClient = {
  from: (table: "user_roles") => {
    select: (cols: string) => {
      eq: (col: string, value: string) => Promise<{ data: unknown }>;
    };
  };
};

/** Throws unless the calling user has the admin role (checked with RLS as that user). */
export async function assertAdmin(client: MinimalClient, userId: string) {
  const { data } = await client.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []) as Array<{ role: string }>;
  if (!roles.some((row) => row.role === "admin")) {
    throw new Error("دسترسی مدیر لازم است");
  }
}
