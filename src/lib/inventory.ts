import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db, type BranchId, type TxType } from "./firebase";

const stockId = (branchId: string, productId: string) =>
  `${branchId}__${productId}`;

interface BaseArgs {
  productId: string;
  productName: string;
  quantity: number;
  note?: string;
  createdBy: string;
  createdByName: string;
}

export async function stockIn(
  args: BaseArgs & { branchId: BranchId },
) {
  const { productId, productName, quantity, note, branchId, createdBy, createdByName } = args;
  if (quantity <= 0) throw new Error("จำนวนต้องมากกว่า 0");

  await runTransaction(db, async (tx) => {
    const stockRef = doc(db, "stock", stockId(branchId, productId));
    const txRef = doc(collection(db, "transactions"));
    const snap = await tx.get(stockRef);
    const before = snap.exists() ? (snap.data().quantity as number) : 0;
    const after = before + quantity;

    tx.set(stockRef, {
      branchId,
      productId,
      quantity: after,
      updatedAt: Date.now(),
    });

    tx.set(txRef, {
      type: "IN" as TxType,
      productId,
      productName,
      branchId,
      quantity,
      quantityBefore: before,
      quantityAfter: after,
      note: note ?? "",
      createdAt: Date.now(),
      createdBy,
      createdByName,
      serverAt: serverTimestamp(),
    });
  });
}

export async function stockOut(
  args: BaseArgs & { branchId: BranchId },
) {
  const { productId, productName, quantity, note, branchId, createdBy, createdByName } = args;
  if (quantity <= 0) throw new Error("จำนวนต้องมากกว่า 0");

  await runTransaction(db, async (tx) => {
    const stockRef = doc(db, "stock", stockId(branchId, productId));
    const txRef = doc(collection(db, "transactions"));
    const snap = await tx.get(stockRef);
    const before = snap.exists() ? (snap.data().quantity as number) : 0;
    if (before < quantity) throw new Error(`สต๊อกไม่พอ (คงเหลือ ${before})`);
    const after = before - quantity;

    tx.set(stockRef, {
      branchId,
      productId,
      quantity: after,
      updatedAt: Date.now(),
    });

    tx.set(txRef, {
      type: "OUT" as TxType,
      productId,
      productName,
      branchId,
      quantity,
      quantityBefore: before,
      quantityAfter: after,
      note: note ?? "",
      createdAt: Date.now(),
      createdBy,
      createdByName,
      serverAt: serverTimestamp(),
    });
  });
}

export async function transferStock(
  args: BaseArgs & { fromBranchId: BranchId; toBranchId: BranchId },
) {
  const {
    productId, productName, quantity, note,
    fromBranchId, toBranchId, createdBy, createdByName,
  } = args;
  if (quantity <= 0) throw new Error("จำนวนต้องมากกว่า 0");
  if (fromBranchId === toBranchId) throw new Error("สาขาต้นทางและปลายทางต้องต่างกัน");

  await runTransaction(db, async (tx) => {
    const fromRef = doc(db, "stock", stockId(fromBranchId, productId));
    const toRef = doc(db, "stock", stockId(toBranchId, productId));
    const txRef = doc(collection(db, "transactions"));

    const fromSnap = await tx.get(fromRef);
    const toSnap = await tx.get(toRef);

    const fromBefore = fromSnap.exists() ? (fromSnap.data().quantity as number) : 0;
    const toBefore = toSnap.exists() ? (toSnap.data().quantity as number) : 0;
    if (fromBefore < quantity) throw new Error(`สต๊อกต้นทางไม่พอ (คงเหลือ ${fromBefore})`);

    const fromAfter = fromBefore - quantity;
    const toAfter = toBefore + quantity;

    tx.set(fromRef, {
      branchId: fromBranchId, productId,
      quantity: fromAfter, updatedAt: Date.now(),
    });
    tx.set(toRef, {
      branchId: toBranchId, productId,
      quantity: toAfter, updatedAt: Date.now(),
    });

    tx.set(txRef, {
      type: "TRANSFER" as TxType,
      productId, productName,
      branchId: fromBranchId,
      fromBranchId, toBranchId,
      quantity,
      quantityBefore: fromBefore,
      quantityAfter: fromAfter,
      // also store dest snapshot for audit
      destQuantityBefore: toBefore,
      destQuantityAfter: toAfter,
      note: note ?? "",
      createdAt: Date.now(),
      createdBy, createdByName,
      serverAt: serverTimestamp(),
    });
  });
}

// Sanity helper for clients to peek a stock value (rare; usually subscribed)
export async function getStockOnce(branchId: string, productId: string) {
  const snap = await getDoc(doc(db, "stock", stockId(branchId, productId)));
  return snap.exists() ? (snap.data().quantity as number) : 0;
}
