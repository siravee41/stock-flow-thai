import { Link, useRouter, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Package, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Boxes, History, Users, LogOut, ChefHat } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { branchName } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "หน้าหลัก", icon: LayoutDashboard, roles: ["owner", "manager", "staff"] },
  { to: "/stock-in", label: "รับเข้า", icon: ArrowDownToLine, roles: ["owner", "manager", "staff"] },
  { to: "/stock-out", label: "เบิกออก", icon: ArrowUpFromLine, roles: ["owner", "manager", "staff"] },
  { to: "/transfer", label: "โอนย้าย", icon: ArrowLeftRight, roles: ["owner", "manager"] },
  { to: "/balance", label: "คงเหลือ", icon: Boxes, roles: ["owner", "manager", "staff"] },
] as const;

const moreItems = [
  { to: "/products", label: "สินค้า", icon: Package, roles: ["owner", "manager"] },
  { to: "/history", label: "ประวัติ", icon: History, roles: ["owner", "manager", "staff"] },
  { to: "/users", label: "ผู้ใช้งาน", icon: Users, roles: ["owner"] },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, logout } = useAuth();
  const router = useRouter();
  const location = useLocation();
  if (!profile) return null;

  const branchLabel = profile.role === "owner"
    ? "ทุกสาขา"
    : profile.branchId ? branchName(profile.branchId) : "—";

  const handleLogout = async () => {
    await logout();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/75 border-b border-border">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-3">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <span className="h-10 w-10 grid place-items-center rounded-xl ink-gradient text-primary-foreground shadow-[var(--shadow-soft)]">
              <ChefHat className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">Pantry</div>
              <div className="text-[11px] text-muted-foreground -mt-0.5">ระบบสต๊อกร้านอาหาร</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block leading-tight">
              <div className="text-[13px] font-medium">{profile.name}</div>
              <div className="text-[11px] text-muted-foreground">{roleLabel(profile.role)} · {branchLabel}</div>
            </div>
            <span className="h-10 w-10 grid place-items-center rounded-full brass-gradient text-accent-foreground font-semibold text-sm shadow-[var(--shadow-soft)]">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="ออกจากระบบ">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Secondary nav (desktop) */}
        <div className="hidden md:block border-t border-border">
          <div className="mx-auto max-w-5xl px-4 h-12 flex items-center gap-1 overflow-x-auto">
            {[...navItems, ...moreItems]
              .filter((i) => i.roles.includes(profile.role))
              .map((item) => {
                const active = location.pathname === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm whitespace-nowrap transition-colors",
                      active ? "bg-secondary text-secondary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    )}
                  >
                    <Icon className="h-4 w-4" /> {item.label}
                  </Link>
                );
              })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-5">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-2 grid grid-cols-5 h-[68px]">
          {navItems
            .filter((i) => i.roles.includes(profile.role))
            .map((item) => {
              const active = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span className={cn(
                    "h-9 w-9 grid place-items-center rounded-xl transition-all",
                    active && "brass-gradient text-accent-foreground shadow-[var(--shadow-soft)]"
                  )}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </div>
      </nav>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "owner") return "เจ้าของ";
  if (role === "manager") return "ผู้จัดการ";
  return "พนักงาน";
}
