import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";

export interface BranchDoc { id: string; name: string }
export interface ProductCrud {
  id: string; code: string; name: string; unit: string;
  category: string; min_stock: number; created_at: number;
}
export interface MovementDoc {
  id: string; product_id: string; branch_id: string;
  type: "IN" | "OUT"; quantity: number; note?: string; created_at: number;
}

function useCollection<T extends { id: string }>(name: string, orderField?: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = orderField
      ? query(collection(db, name), orderBy(orderField, orderField === "created_at" ? "desc" : "asc"))
      : query(collection(db, name));
    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<T, "id">) })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [name, orderField]);
  return { data, loading };
}

export const useBranches = () => useCollection<BranchDoc>("branches", "name");
export const useProductsCrud = () => useCollection<ProductCrud>("products_v2", "name");
export const useMovements = () => useCollection<MovementDoc>("stock_movements", "created_at");
