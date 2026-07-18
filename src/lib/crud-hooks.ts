// Compatibility hooks reading from Lovable Cloud tables.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BranchDoc { id: string; name: string; short_name?: string | null }
export interface ProductCrud {
  id: string; code: string; name: string; unit: string;
  category: string; min_stock: number; created_at: number;
}
export interface MovementDoc {
  id: string; product_id: string; branch_id: string;
  type: "IN" | "OUT" | "TRANSFER"; quantity: number; note?: string; created_at: number;
}

export function useBranches() {
  const [data, setData] = useState<BranchDoc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      const { data: rows } = await supabase.from("branches").select("*").order("name");
      if (!mounted) return;
      setData((rows ?? []) as BranchDoc[]);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel("branches-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "branches" }, () => fetch())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);
  return { data, loading };
}

export function useProductsCrud() {
  const [data, setData] = useState<ProductCrud[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      const { data: rows } = await supabase.from("products").select("*").order("name");
      if (!mounted) return;
      setData((rows ?? []).map((r) => ({
        id: r.id as string,
        code: (r.sku as string) ?? "",
        name: r.name as string,
        unit: (r.unit as string) ?? "",
        category: (r.category as string) ?? "",
        min_stock: Number(r.min_stock) || 0,
        created_at: new Date(r.created_at as string).getTime(),
      })));
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel("products-crud-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => fetch())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);
  return { data, loading };
}

export function useMovements() {
  const [data, setData] = useState<MovementDoc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      const { data: rows } = await supabase.from("stock_movements")
        .select("id, product_id, branch_id, type, quantity, note, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (!mounted) return;
      setData((rows ?? []).map((r) => ({
        id: r.id as string,
        product_id: r.product_id as string,
        branch_id: r.branch_id as string,
        type: r.type as "IN" | "OUT" | "TRANSFER",
        quantity: Number(r.quantity),
        note: (r.note as string) ?? "",
        created_at: new Date(r.created_at as string).getTime(),
      })));
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel("movements-crud-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, () => fetch())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);
  return { data, loading };
}
