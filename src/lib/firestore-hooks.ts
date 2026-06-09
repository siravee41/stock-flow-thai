import { useEffect, useState } from "react";
import {
  collection, onSnapshot, query, orderBy, where, limit as fbLimit, type QueryConstraint,
} from "firebase/firestore";
import { db, type Product, type StockDoc, type Transaction } from "./firebase";

export function useProducts() {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);
  return { data, loading };
}

export function useStock(branchId?: string | null) {
  const [data, setData] = useState<StockDoc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const constraints: QueryConstraint[] = [];
    if (branchId) constraints.push(where("branchId", "==", branchId));
    const q = query(collection(db, "stock"), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockDoc, "id">) })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [branchId]);
  return { data, loading };
}

export function useTransactions(opts: { branchId?: string | null; limit?: number } = {}) {
  const { branchId, limit = 200 } = opts;
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), fbLimit(limit)];
    if (branchId) constraints.unshift(where("branchId", "==", branchId));
    const q = query(collection(db, "transactions"), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, "id">) })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [branchId, limit]);
  return { data, loading };
}

export function useUsers() {
  const [data, setData] = useState<Array<{ uid: string; email: string; name: string; role: string; branchId: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setData(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as { email: string; name: string; role: string; branchId: string | null }) })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);
  return { data, loading };
}
