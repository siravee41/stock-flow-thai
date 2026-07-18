import { supabase } from "@/integrations/supabase/client";
import type { BranchId } from "./firebase";

interface BaseArgs {
  productId: string;
  productName: string;
  quantity: number;
  note?: string;
  createdBy: string;
  createdByName: string;
}

async function callRpc(args: {
  type: "IN" | "OUT" | "TRANSFER";
  productId: string;
  branchId: BranchId;
  toBranchId?: BranchId;
  quantity: number;
  note?: string;
}) {
  const { data, error } = await supabase.rpc("perform_stock_movement", {
    _type: args.type,
    _product_id: args.productId,
    _branch_id: args.branchId,
    _to_branch_id: (args.toBranchId ?? null) as string,
    _quantity: args.quantity,
    _note: (args.note ?? null) as string,
  });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("insufficient_stock")) throw new Error("สต๊อกไม่พอ");
    if (msg.includes("invalid_destination")) throw new Error("สาขาต้นทางและปลายทางต้องต่างกัน");
    if (msg.includes("forbidden_branch")) throw new Error("ไม่มีสิทธิ์ทำรายการที่สาขานี้");
    if (msg.includes("product_not_found")) throw new Error("ไม่พบสินค้า");
    throw new Error(msg);
  }
  return data as string;
}

export async function stockIn(args: BaseArgs & { branchId: BranchId }) {
  if (args.quantity <= 0) throw new Error("จำนวนต้องมากกว่า 0");
  await callRpc({ type: "IN", productId: args.productId, branchId: args.branchId, quantity: args.quantity, note: args.note });
}

export async function stockOut(args: BaseArgs & { branchId: BranchId }) {
  if (args.quantity <= 0) throw new Error("จำนวนต้องมากกว่า 0");
  await callRpc({ type: "OUT", productId: args.productId, branchId: args.branchId, quantity: args.quantity, note: args.note });
}

export async function transferStock(args: BaseArgs & { fromBranchId: BranchId; toBranchId: BranchId }) {
  if (args.quantity <= 0) throw new Error("จำนวนต้องมากกว่า 0");
  if (args.fromBranchId === args.toBranchId) throw new Error("สาขาต้นทางและปลายทางต้องต่างกัน");
  await callRpc({
    type: "TRANSFER", productId: args.productId,
    branchId: args.fromBranchId, toBranchId: args.toBranchId,
    quantity: args.quantity, note: args.note,
  });
}

export async function getStockOnce(branchId: string, productId: string) {
  const { data } = await supabase.from("stock_balances")
    .select("quantity").eq("branch_id", branchId).eq("product_id", productId).maybeSingle();
  return data ? Number(data.quantity) || 0 : 0;
}
