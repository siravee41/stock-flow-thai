import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useProducts, useStock } from "@/lib/firestore-hooks";
import { BRANCHES, branchName, type BranchId } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/balance")({
  component: BalancePage,
});

function BalancePage() {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const [branchFilter, setBranchFilter] = useState<string>(
    isOwner ? "all" : (profile?.branchId ?? "all"),
  );
  const [search, setSearch] = useState("");

  const branchArg = branchFilter === "all" ? null : branchFilter;
  const { data: stock } = useStock(branchArg);
  const { data: products } = useProducts();

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // group: per product, show per-branch breakdown (only if owner viewing all)
  const rows = useMemo(() => {
    const filtered = stock.filter((s) => {
      const p = productMap.get(s.productId);
      if (!p) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
    // Per product aggregate
    const byProduct = new Map<string, { product: typeof products[number]; total: number; perBranch: Record<string, number> }>();
    for (const s of filtered) {
      const p = productMap.get(s.productId)!;
      const cur = byProduct.get(p.id) ?? { product: p, total: 0, perBranch: {} };
      cur.total += s.quantity;
      cur.perBranch[s.branchId] = (cur.perBranch[s.branchId] ?? 0) + s.quantity;
      byProduct.set(p.id, cur);
    }
    return Array.from(byProduct.values()).sort((a, b) => a.product.name.localeCompare(b.product.name, "th"));
  }, [stock, productMap, search, products]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">สต๊อกคงเหลือ</h1>
        <p className="text-sm text-muted-foreground">อัปเดตเรียลไทม์ทุกสาขา</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาสินค้า" className="pl-9 h-11" />
        </div>
        {isOwner && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="h-11 sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสาขา</SelectItem>
              {BRANCHES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="card-soft divide-y divide-border">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">ยังไม่มีสต๊อกที่ตรง</div>
        ) : rows.map(({ product, total, perBranch }) => {
          const low = product.minStock > 0 && total <= product.minStock;
          return (
            <div key={product.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {product.name}
                    {low && <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                      <AlertTriangle className="h-3 w-3" /> ใกล้หมด</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{product.category || "—"} · ขั้นต่ำ {product.minStock} {product.unit}</div>
                </div>
                <div className="text-right">
                  <div className={cn("text-xl font-semibold tabular-nums", low && "text-destructive")}>{total.toLocaleString("th-TH")}</div>
                  <div className="text-[11px] text-muted-foreground">{product.unit}</div>
                </div>
              </div>
              {(isOwner && branchFilter === "all") && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  {BRANCHES.map((b) => (
                    <div key={b.id} className="rounded-lg bg-secondary/40 border border-border px-3 py-2">
                      <div className="text-[11px] text-muted-foreground">{b.short}</div>
                      <div className="text-sm font-semibold tabular-nums">{(perBranch[b.id] ?? 0).toLocaleString("th-TH")}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
