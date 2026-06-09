import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB6qGcmOeEukYUwZoDpv1f4koJPZzCmf0I",
  authDomain: "stock-system-d1250.firebaseapp.com",
  projectId: "stock-system-d1250",
  storageBucket: "stock-system-d1250.firebasestorage.app",
  messagingSenderId: "135636367674",
  appId: "1:135636367674:web:55f47eb0445df30addb803",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const BRANCHES = [
  { id: "central-kitchen", name: "Central Kitchen", short: "ครัวกลาง" },
  { id: "yukata-shabu", name: "Yukata Shabu", short: "ยูกาตะ" },
  { id: "hongdae-bbq", name: "HongDae Korean BBQ", short: "ฮงแด" },
  { id: "yokoya-izakaya", name: "Yokoya Izakaya", short: "โยโกย่า" },
] as const;

export type BranchId = (typeof BRANCHES)[number]["id"];
export const branchName = (id: string) =>
  BRANCHES.find((b) => b.id === id)?.name ?? id;

export type Role = "owner" | "manager" | "staff";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: Role;
  branchId: BranchId | null; // null for owner
  createdAt: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  category: string;
  minStock: number;
  createdAt: number;
}

export interface StockDoc {
  id: string; // `${branchId}__${productId}`
  branchId: BranchId;
  productId: string;
  quantity: number;
  updatedAt: number;
}

export type TxType = "IN" | "OUT" | "TRANSFER";

export interface Transaction {
  id: string;
  type: TxType;
  productId: string;
  productName: string;
  branchId: BranchId; // primary branch (source for transfer/out, dest for in)
  fromBranchId?: BranchId;
  toBranchId?: BranchId;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  note?: string;
  createdAt: number;
  createdBy: string;
  createdByName: string;
}
