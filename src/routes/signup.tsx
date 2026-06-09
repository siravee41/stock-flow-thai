import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRANCHES, type BranchId, type Role } from "@/lib/firebase";
import { ChefHat } from "lucide-react";

export const Route = createFileRoute("/signup")({
  ssr: false,
  component: SignupPage,
});

function SignupPage() {
  const { user, loading, signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    role: "staff" as Role,
    branchId: "central-kitchen" as BranchId,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError(null);
    try {
      await signUp({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim() || form.email.split("@")[0],
        role: form.role,
        branchId: form.role === "owner" ? null : form.branchId,
      });
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("email-already-in-use") ? "อีเมลนี้ถูกใช้แล้ว" : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 card-soft p-6">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 grid place-items-center rounded-xl ink-gradient text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">สมัครใช้งาน</h2>
            <p className="text-xs text-muted-foreground">ผู้ใช้คนแรกของระบบจะถูกตั้งเป็นเจ้าของอัตโนมัติ</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>ชื่อ-นามสกุล</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เช่น สมชาย ใจดี" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>อีเมล</Label>
            <Input type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>รหัสผ่าน</Label>
            <Input type="password" required minLength={6} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="อย่างน้อย 6 ตัวอักษร" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>บทบาท</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">เจ้าของ (ทุกสาขา)</SelectItem>
                <SelectItem value="manager">ผู้จัดการสาขา</SelectItem>
                <SelectItem value="staff">พนักงาน</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.role !== "owner" && (
            <div className="space-y-1.5">
              <Label>สาขา</Label>
              <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v as BranchId })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BRANCHES.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>}

        <Button type="submit" variant="ink" size="lg" disabled={submitting} className="w-full">
          {submitting ? "กำลังสมัคร..." : "สมัครและเข้าสู่ระบบ"}
        </Button>

        <div className="text-sm text-center text-muted-foreground">
          มีบัญชีแล้ว? <Link to="/login" className="text-foreground font-medium underline underline-offset-2">เข้าสู่ระบบ</Link>
        </div>
      </form>
    </div>
  );
}
