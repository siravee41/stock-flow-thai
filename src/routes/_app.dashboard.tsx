import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useProducts, useStock, useTransactions } from "@/lib/firestore-hooks";
import { BRANCHES, branchName, type BranchId } from "@/lib/firebase";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, AlertTriangle, Boxes, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const branchFilter = isOwner ? null : profile?.branchId ?? null;

  const { data: products } = useProducts();
  const { data: stock } = useStock(branchFilter);
  const { data: txs } = useTransactions({ branchId: branchFilter, limit: 50 });

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const totals = useMemo(() => {
    const totalUnits = stock.reduce((s, x) => s + (x.quantity || 0), 0);
    const lowStock = stock.filter((x) => {
      const p = productMap.get(x.productId);
      return p && p.minStock > 0 && x.quantity <= p.minStock;
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTx = txs.filter((t) => t.createdAt >= today.getTime());
    return { totalUnits, lowStock, todayTxCount: todayTx.length };
  }, [stock, txs, productMap]);

  const byBranch = useMemo(() => {
    if (!isOwner) return [];
    return BRANCHES.map((b) => {
      const rows = stock.filter((s) => s.branchId === b.id);
      const units = rows.reduce((s, x) => s + x.quantity, 0);
      const low = rows.filter((x) => {
        const p = productMap.get(x.productId);
        return p && p.minStock > 0 && x.quantity <= p.minStock;
      }).length;
      return { ...b, units, low };
    });
  }, [stock, isOwner, productMap]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">สวัสดี {profile?.name}</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-0.5">
          {isOwner ? "ภาพรวมทุกสาขา" : `สาขา ${branchName(profile?.branchId ?? "")}`}
        </h1>
      </div>

      {/* Action tiles */}
      <div className="grid grid-cols-3 gap-3">
        <ActionTile to="/stock-in" label="รับเข้า" icon={ArrowDownToLine} tone="ink" />
        <ActionTile to="/stock-out" label="เบิกออก" icon={ArrowUpFromLine} tone="brass" />
        <ActionTile to="/transfer" label="โอนย้าย" icon={ArrowLeftRight} tone="outline"
          disabled={profile?.role === "staff"} />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Boxes} label="รายการสินค้า" value={products.length.toLocaleString("th-TH")} />
        <Kpi icon={TrendingUp} label="จำนวนคงเหลือรวม" value={totals.totalUnits.toLocaleString("th-TH")} />
        <Kpi icon={ArrowLeftRight} label="ธุรกรรมวันนี้" value={totals.todayTxCount.toLocaleString("th-TH")} />
        <Kpi icon={AlertTriangle} label="สินค้าใกล้หมด" value={totals.lowStock.length.toLocaleString("th-TH")}
          tone={totals.lowStock.length > 0 ? "warn" : undefined} />
      </div>

      {/* Owner: branch overview */}
      {isOwner && (
        <section className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">ภาพรวมรายสาขา</h2>
            <Link to="/balance" className="text-xs text-muted-foreground hover:text-foreground underline">ดูทั้งหมด</Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {byBranch.map((b) => (
              <div key={b.id} className="rounded-xl border border-border p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{b.short}</div>
                  <div className="font-medium">{b.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold tabular-nums">{b.units.toLocaleString("th-TH")}</div>
                  <div className={`text-[11px] ${b.low > 0 ? "text-warning-foreground" : "text-muted-foreground"}`}>
                    {b.low > 0 ? `${b.low} รายการใกล้หมด` : "ปกติ"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Low stock */}
      {totals.lowStock.length > 0 && (
        <section className="card-soft p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            <h2 className="font-semibold">แจ้งเตือนสินค้าใกล้หมด</h2>
          </div>
          <ul className="divide-y divide-border">
            {totals.lowStock.slice(0, 8).map((s) => {
              const p = productMap.get(s.productId);
              return (
                <li key={s.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p?.name ?? s.productId}</div>
                    <div className="text-xs text-muted-foreground">
                      {branchName(s.branchId)} · ขั้นต่ำ {p?.minStock ?? 0} {p?.unit ?? ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold text-destructive tabular-nums">
                      {s.quantity.toLocaleString("th-TH")}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{p?.unit}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Recent activity */}
      <section className="card-soft p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">กิจกรรมล่าสุด</h2>
          <Link to="/history" className="text-xs text-muted-foreground hover:text-foreground underline">ดูทั้งหมด</Link>
        </div>
        {txs.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">ยังไม่มีธุรกรรม</div>
        ) : (
          <ul className="divide-y divide-border">
            {txs.slice(0, 8).map((t) => <TxRow key={t.id} t={t} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActionTile({ to, label, icon: Icon, tone, disabled }: {
  to: "/stock-in" | "/stock-out" | "/transfer";
  label: string;
  icon: typeof ArrowDownToLine;
  tone: "ink" | "brass" | "outline";
  disabled?: boolean;
}) {
  const cls =
    tone === "ink" ? "ink-gradient text-primary-foreground"
    : tone === "brass" ? "brass-gradient text-accent-foreground"
    : "bg-card border border-border text-foreground";
  if (disabled) {
    return (
      <div className={`${cls} opacity-40 rounded-2xl p-4 h-28 flex flex-col justify-between cursor-not-allowed`}>
        <Icon className="h-6 w-6" />
        <div className="font-semibold">{label}</div>
      </div>
    );
  }
  return (
    <Link to={to} className={`${cls} rounded-2xl p-4 h-28 flex flex-col justify-between shadow-[var(--shadow-soft)] active:scale-[0.98] transition`}>
      <Icon className="h-6 w-6" />
      <div className="font-semibold">{label}</div>
    </Link>
  );
}

function Kpi({ icon: Icon, label, value, tone }: {
  icon: typeof Boxes; label: string; value: string; tone?: "warn";
}) {
  return (
    <div className="card-soft p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${tone === "warn" ? "text-warning-foreground" : "text-muted-foreground"}`} />
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

function TxRow({ t }: { t: import("@/lib/firebase").Transaction }) {
  const tone = t.type === "IN" ? "text-success" : t.type === "OUT" ? "text-destructive" : "text-accent-foreground";
  const sign = t.type === "IN" ? "+" : t.type === "OUT" ? "−" : "↔";
  const label = t.type === "IN" ? "รับเข้า" : t.type === "OUT" ? "เบิกออก" : "โอนย้าย";
  return (
    <li className="py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium truncate">{t.productName}</div>
        <div className="text-xs text-muted-foreground truncate">
          {label} · {t.type === "TRANSFER"
            ? `${branchName(t.fromBranchId ?? "")} → ${branchName(t.toBranchId ?? "")}`
            : branchName(t.branchId as BranchId)}
          {" · "}{new Date(t.createdAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
        </div>
      </div>
      <div className={`text-base font-semibold tabular-nums ${tone}`}>{sign}{t.quantity}</div>
    </li>
  );
}
