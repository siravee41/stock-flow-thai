// Realtime hooks backed by Lovable Cloud (Supabase). Public API kept for compatibility.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Product, StockDoc, Transaction, BranchId, TxType } from "./firebase";

type ProductRow = {
  id: string; sku: string; name: string; unit: string;
  category: string | null; min_stock: number; created_at: string;
};
function mapProduct(r: ProductRow): Product {
  return {
    id: r.id, sku: r.sku ?? "", name: r.name, unit: r.unit ?? "",
    category: r.category ?? "", minStock: Number(r.min_stock) || 0,
    createdAt: new Date(r.created_at).getTime(),
  };
}

export function useProducts() {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      const { data: rows } = await supabase.from("products").select("*").order("name");
      if (!mounted) return;
      setData((rows ?? []).map((r) => mapProduct(r as ProductRow)));
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel("products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => fetch())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);
  return { data, loading };
}

type BalanceRow = { branch_id: string; product_id: string; quantity: number; updated_at: string };
function mapBalance(r: BalanceRow): StockDoc {
  return {
    id: `${r.branch_id}__${r.product_id}`,
    branchId: r.branch_id as BranchId,
    productId: r.product_id,
    quantity: Number(r.quantity) || 0,
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

export function useStock(branchId?: string | null) {
  const [data, setData] = useState<StockDoc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      let q = supabase.from("stock_balances").select("*");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data: rows } = await q;
      if (!mounted) return;
      setData((rows ?? []).map((r) => mapBalance(r as BalanceRow)));
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel(`balances-${branchId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_balances" }, () => fetch())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [branchId]);
  return { data, loading };
}

type MoveRow = {
  id: string; type: TxType; product_id: string; product_name: string;
  branch_id: string; from_branch_id: string | null; to_branch_id: string | null;
  quantity: number; quantity_before: number; quantity_after: number;
  note: string | null; created_at: string; created_by: string; created_by_name: string;
};
function mapMove(r: MoveRow): Transaction {
  return {
    id: r.id, type: r.type,
    productId: r.product_id, productName: r.product_name,
    branchId: r.branch_id as BranchId,
    fromBranchId: (r.from_branch_id ?? undefined) as BranchId | undefined,
    toBranchId: (r.to_branch_id ?? undefined) as BranchId | undefined,
    quantity: Number(r.quantity),
    quantityBefore: Number(r.quantity_before),
    quantityAfter: Number(r.quantity_after),
    note: r.note ?? "",
    createdAt: new Date(r.created_at).getTime(),
    createdBy: r.created_by,
    createdByName: r.created_by_name,
  };
}

export function useTransactions(opts: { branchId?: string | null; limit?: number } = {}) {
  const { branchId, limit = 200 } = opts;
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      let q = supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(limit);
      if (branchId) q = q.or(`branch_id.eq.${branchId},from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
      const { data: rows } = await q;
      if (!mounted) return;
      setData((rows ?? []).map((r) => mapMove(r as MoveRow)));
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel(`movements-${branchId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, () => fetch())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [branchId, limit]);
  return { data, loading };
}

export function useUsers() {
  const [data, setData] = useState<Array<{ uid: string; email: string; name: string; role: string; branchId: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, name"),
        supabase.from("user_roles").select("user_id, role, branch_id"),
      ]);
      if (!mounted) return;
      const byUid = new Map<string, { role: string; branchId: string | null }>();
      for (const r of roles ?? []) {
        if (!byUid.has(r.user_id) || r.role === "owner") {
          byUid.set(r.user_id, { role: r.role, branchId: r.branch_id ?? null });
        }
      }
      setData((profiles ?? []).map((p) => ({
        uid: p.id, email: p.email, name: p.name,
        role: byUid.get(p.id)?.role ?? "staff",
        branchId: byUid.get(p.id)?.branchId ?? null,
      })));
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel("users-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => fetch())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);
  return { data, loading };
}
