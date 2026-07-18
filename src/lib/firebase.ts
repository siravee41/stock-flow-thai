// Backwards-compatible constants & types.
// The system now runs on Lovable Cloud — this file no longer initializes Firebase.

export const BRANCHES = [
  { id: "central-kitchen", name: "Central Kitchen", short: "ครัวกลาง" },
  { id: "yukata-shabu", name: "Yukata Shabu", short: "ยูกาตะ" },
  { id: "hongdae-bbq", name: "HongDae Korean BBQ", short: "ฮงแด" },
  { id: "yokoya-izakaya", name: "Yokoya Izakaya", short: "โยโกย่า" },
] as const;

export type BranchId = (typeof BRANCHES)[number]["id"];
export const branchName = (id: string) =>
  BRANCHES.find((b) => b.id === id)?.name ?? id;

export type Role = "owner" | "manager" | "staff" | "warehouse";

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
  branchId: BranchId;
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
