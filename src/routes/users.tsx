import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminOnly } from "@/components/AdminOnly";
import { BackupSection } from "@/components/BackupSection";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCollaborator, deleteMember } from "@/lib/admin-users.functions";
import { faDate, faDigits } from "@/lib/fa";
import {
  fetchMembers,
  ROLE_LABELS,
  setMemberActive,
  setMemberRole,
  type AppRole,
  type Member,
} from "@/lib/roles";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "مدیریت همکارها | املاک صدرا" },
      {
        name: "description",
        content:
          "مدیریت کاربران و همکارهای سامانه املاک صدرا: افزودن همکار، تعیین نقش و کنترل دسترسی.",
      },
      { property: "og:title", content: "مدیریت همکارها" },
      {
        property: "og:description",
        content: "افزودن همکار، تعیین نقش مدیر یا همکار و فعال/غیرفعال کردن دسترسی.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AdminOnly>{(userId) => <Users currentUserId={userId} />}</AdminOnly>,
});

function Users({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["members"], queryFn: fetchMembers });

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("collaborator");

  const create = useServerFn(createCollaborator);
  const remove = useServerFn(deleteMember);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["members"] });
  }

  const addMember = useMutation({
    mutationFn: () => create({ data: { email, password, fullName, role } }),
    onSuccess: async () => {
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("collaborator");
      await refresh();
      toast.success("کاربر جدید ساخته شد");
    },
    onError: (error: Error) => toast.error(error.message || "ایجاد کاربر ناموفق بود"),
  });

  const toggleActive = useMutation({
    mutationFn: (member: Member) => setMemberActive(member.id, !member.is_active),
    onSuccess: async () => {
      await refresh();
      toast.success("وضعیت دسترسی به‌روزرسانی شد");
    },
    onError: () => toast.error("تغییر دسترسی ناموفق بود"),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: AppRole }) =>
      setMemberRole(id, nextRole),
    onSuccess: async () => {
      await refresh();
      toast.success("نقش کاربر تغییر کرد");
    },
    onError: () => toast.error("تغییر نقش ناموفق بود"),
  });

  const removeMember = useMutation({
    mutationFn: (id: string) => remove({ data: { userId: id } }),
    onSuccess: async () => {
      await refresh();
      toast.success("کاربر حذف شد");
    },
    onError: (error: Error) => toast.error(error.message || "حذف کاربر ناموفق بود"),
  });

  const members = data ?? [];

  return (
    <AppShell title="مدیریت همکارها" subtitle={`${faDigits(members.length)} کاربر`}>
      <div className="space-y-4">
        <section className="surface-card space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <UserPlus className="size-4 text-primary" />
            افزودن همکار جدید
          </h2>
          <div className="space-y-2">
            <div>
              <Label htmlFor="member-name" className="text-xs">
                نام
              </Label>
              <Input
                id="member-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="نام و نام خانوادگی"
                className="h-11"
              />
            </div>
            <div>
              <Label htmlFor="member-email" className="text-xs">
                ایمیل
              </Label>
              <Input
                id="member-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="h-11"
              />
            </div>
            <div>
              <Label htmlFor="member-password" className="text-xs">
                رمز عبور اولیه (حداقل ۸ کاراکتر)
              </Label>
              <Input
                id="member-password"
                type="text"
                dir="ltr"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ROLE_LABELS) as AppRole[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRole(key)}
                  className={`h-10 rounded-xl border text-xs font-medium transition-colors ${
                    role === key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {ROLE_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
          <Button
            className="h-11 w-full"
            disabled={addMember.isPending || !email || password.length < 8}
            onClick={() => addMember.mutate()}
          >
            {addMember.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            ساخت حساب همکار
          </Button>
          <p className="text-[11px] leading-6 text-muted-foreground">
            ایمیل و رمز عبور را به همکار بدهید تا از صفحه ورود وارد شود. ثبت‌نام آزاد در سامانه
            بسته است و فقط شما می‌توانید کاربر اضافه کنید.
          </p>
        </section>

        <BackupSection />


        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <section className="space-y-3">
            {members.map((member) => {
              const isSelf = member.id === currentUserId;
              return (
                <div key={member.id} className="surface-card space-y-3 p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {member.full_name || "بدون نام"}
                        {isSelf ? (
                          <span className="ms-2 text-[11px] text-primary">(شما)</span>
                        ) : null}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Mail className="size-3" />
                        <span dir="ltr">{member.email ?? "—"}</span>
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        member.role === "admin"
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {ROLE_LABELS[member.role]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span
                      className={`rounded-full px-2 py-1 font-semibold ${
                        member.is_active
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {member.is_active ? "دسترسی فعال" : "دسترسی غیرفعال"}
                    </span>
                    <span>عضویت: {faDate(member.created_at)}</span>
                  </div>

                  {isSelf ? (
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <ShieldCheck className="size-3 text-primary" />
                      حساب مدیر اصلی؛ نقش و دسترسی آن قابل تغییر نیست.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="secondary"
                        className="h-10 text-xs"
                        disabled={changeRole.isPending}
                        onClick={() =>
                          changeRole.mutate({
                            id: member.id,
                            nextRole: member.role === "admin" ? "collaborator" : "admin",
                          })
                        }
                      >
                        {member.role === "admin" ? "تبدیل به همکار" : "تبدیل به مدیر"}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 text-xs"
                        disabled={toggleActive.isPending}
                        onClick={() => toggleActive.mutate(member)}
                      >
                        {member.is_active ? "غیرفعال کردن" : "فعال کردن"}
                      </Button>
                      <Button
                        variant="destructive"
                        className="h-10 text-xs"
                        disabled={removeMember.isPending}
                        onClick={() => {
                          if (window.confirm("این کاربر حذف شود؟")) removeMember.mutate(member.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </AppShell>
  );
}
