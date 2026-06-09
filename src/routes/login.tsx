import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChefHat } from "lucide-react";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(humanizeAuthError(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative overflow-hidden ink-gradient text-primary-foreground p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 grid place-items-center rounded-xl brass-gradient text-accent-foreground">
            <ChefHat className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-lg">Pantry</div>
            <div className="text-xs text-primary-foreground/70">ระบบสต๊อกครัวกลาง</div>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-semibold leading-tight">
            จัดการวัตถุดิบ<br />ทุกสาขา ในที่เดียว
          </h1>
          <p className="mt-4 text-primary-foreground/70 max-w-md">
            ซิงค์เรียลไทม์ระหว่างครัวกลางและทุกสาขา รับเข้า เบิกออก โอนย้าย — ตรวจสอบย้อนหลังได้ทุก movement
          </p>
        </div>
        <div className="text-xs text-primary-foreground/50">© Pantry · Restaurant Inventory</div>
        <div className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full brass-gradient opacity-25 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <span className="h-11 w-11 grid place-items-center rounded-xl ink-gradient text-primary-foreground">
              <ChefHat className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold">Pantry</div>
              <div className="text-xs text-muted-foreground">ระบบสต๊อกร้านอาหาร</div>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">ยินดีต้อนรับกลับมา</h2>
            <p className="text-sm text-muted-foreground mt-1">เข้าสู่ระบบเพื่อจัดการสต๊อกของคุณ</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">อีเมล</Label>
              <Input id="email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.com"
                className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11" />
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>
          )}

          <Button type="submit" variant="ink" size="lg" disabled={submitting} className="w-full">
            {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </Button>

          <div className="text-sm text-center text-muted-foreground">
            ยังไม่มีบัญชี?{" "}
            <Link to="/signup" className="text-foreground font-medium underline underline-offset-2">สมัครใช้งาน</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function humanizeAuthError(msg: string) {
  if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found"))
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (msg.includes("too-many-requests")) return "พยายามเข้าระบบบ่อยเกินไป กรุณารอสักครู่";
  if (msg.includes("network")) return "เครือข่ายมีปัญหา กรุณาลองใหม่";
  return msg;
}
