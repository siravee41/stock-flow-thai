import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUsers } from "@/lib/firestore-hooks";
import { supabase } from "@/integrations/supabase/client";
import { BRANCHES, type BranchId, type Role } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

async function upsertRole(uid: string, role: Role, branchId: BranchId | null) {
  // Replace all roles for this user with the new one row
  await supabase.from("user_roles").delete().eq("user_id", uid);
  await supabase.from("user_roles").insert({
    user_id: uid,
    role,
    branch_id: role === "owner" ? null : branchId,
  });
}

function UsersPage() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const { data: users, loading } = useUsers();
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile && profile.role !== "owner") nav({ to: "/dashboard", replace: true });
  }, [profile, nav]);

  if (profile?.role !== "owner") return null;

  const setRole = async (uid: string, role: Role) => {
    setSavingId(uid);
    try {
      const current = users.find((u) => u.uid === uid);
      const branch = (current?.branchId ?? "central-kitchen") as BranchId;
      await upsertRole(uid, role, branch);
    } finally { setSavingId(null); }
  };
  const setBranch = async (uid: string, branchId: BranchId) => {
    setSavingId(uid);
    try {
      const current = users.find((u) => u.uid === uid);
      const role = (current?.role ?? "staff") as Role;
      await upsertRole(uid, role, branchId);
    } finally { setSavingId(null); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ผู้ใช้งาน</h1>
        <p className="text-sm text-muted-foreground">จัดการบทบาทและสาขาของผู้ใช้</p>
      </div>

      <div className="card-soft divide-y divide-border">
        {loading ? (
          <div className="p-6 text-sm text-center text-muted-foreground">กำลังโหลด...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-sm text-center text-muted-foreground">ยังไม่มีผู้ใช้งาน</div>
        ) : users.map((u) => (
          <div key={u.uid} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="h-10 w-10 grid place-items-center rounded-full brass-gradient text-accent-foreground font-semibold">
                {u.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="font-medium truncate">{u.name}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:w-[420px]">
              <Select value={u.role} onValueChange={(v) => setRole(u.uid, v as Role)} disabled={u.uid === profile.uid}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">เจ้าของ</SelectItem>
                  <SelectItem value="manager">ผู้จัดการ</SelectItem>
                  <SelectItem value="staff">พนักงาน</SelectItem>
                  <SelectItem value="warehouse">คลังกลาง</SelectItem>
                </SelectContent>
              </Select>
              {u.role !== "owner" && (
                <Select value={u.branchId ?? "central-kitchen"}
                  onValueChange={(v) => setBranch(u.uid, v as BranchId)}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="สาขา" /></SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {u.role === "owner" && (
                <div className="h-10 px-3 rounded-lg border border-border bg-secondary/40 flex items-center text-sm flex-1">ทุกสาขา</div>
              )}
            </div>
            {savingId === u.uid && <span className="text-xs text-muted-foreground">กำลังบันทึก...</span>}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        หมายเหตุ: สร้างผู้ใช้ใหม่ผ่านหน้าสมัครสมาชิก (/signup) แล้วเจ้าของสามารถปรับบทบาท/สาขาได้ที่นี่
      </p>
    </div>
  );
}
