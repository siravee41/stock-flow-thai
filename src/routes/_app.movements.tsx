import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useMovements, useBranches, useProductsCrud, type MovementDoc } from "@/lib/crud-hooks";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

export const Route = createFileRoute("/_app/movements")({ component: MovementsPage });

function MovementsPage() {
  const { profile } = useAuth();
  const { data, loading } = useMovements();
  const { data: branches } = useBranches();
  const { data: products } = useProductsCrud();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MovementDoc | null>(null);
  const canEdit = profile?.role === "owner" || profile?.role === "manager";

  const bMap = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, b.name])), [branches]);
  const pMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">การเคลื่อนไหวสต๊อก</h1>
          <p className="text-sm text-muted-foreground">collection: stock_movements</p>
        </div>
        <Button variant="ink" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> บันทึกรายการ
        </Button>
      </div>
      <div className="card-soft divide-y divide-border">
        {loading ? <div className="p-6 text-center text-muted-foreground text-sm">กำลังโหลด...</div>
          : data.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">ยังไม่มีรายการ</div>
          : data.map((m) => {
            const p = pMap[m.product_id];
            return (
              <div key={m.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`h-10 w-10 grid place-items-center rounded-xl ${m.type === "IN" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {m.type === "IN" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {p?.name ?? m.product_id} · {m.quantity} {p?.unit ?? ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {bMap[m.branch_id] ?? m.branch_id} · {new Date(m.created_at).toLocaleString("th-TH")}
                      {m.note ? ` · ${m.note}` : ""}
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(m); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={async () => { if (confirm("ลบรายการนี้?")) await deleteDoc(doc(db, "stock_movements", m.id)); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
      </div>
      <MovementDialog open={open} onOpenChange={setOpen} editing={editing} branches={branches} products={products} />
    </div>
  );
}

function MovementDialog({ open, onOpenChange, editing, branches, products }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: MovementDoc | null;
  branches: { id: string; name: string }[]; products: { id: string; name: string }[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    product_id: editing?.product_id ?? "", branch_id: editing?.branch_id ?? "",
    type: (editing?.type ?? "IN") as "IN" | "OUT", quantity: editing?.quantity ?? 0, note: editing?.note ?? "",
  });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.product_id || !form.branch_id || !form.quantity) return;
    setSubmitting(true);
    try {
      const payload = {
        product_id: form.product_id, branch_id: form.branch_id, type: form.type,
        quantity: Number(form.quantity), note: form.note.trim(),
      };
      if (editing) await updateDoc(doc(db, "stock_movements", editing.id), payload);
      else await addDoc(collection(db, "stock_movements"), { ...payload, created_at: Date.now() });
      onOpenChange(false);
    } finally { setSubmitting(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (v) setForm({
        product_id: editing?.product_id ?? "", branch_id: editing?.branch_id ?? "",
        type: (editing?.type ?? "IN") as "IN" | "OUT", quantity: editing?.quantity ?? 0, note: editing?.note ?? "",
      });
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "แก้ไขรายการ" : "บันทึกการเคลื่อนไหว"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>ประเภท</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "IN" | "OUT" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">รับเข้า (IN)</SelectItem>
                <SelectItem value="OUT">เบิกออก (OUT)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>สินค้า *</Label>
            <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกสินค้า" /></SelectTrigger>
              <SelectContent>
                {products.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">ยังไม่มีสินค้า</div>}
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>สาขา *</Label>
            <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกสาขา" /></SelectTrigger>
              <SelectContent>
                {branches.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">ยังไม่มีสาขา</div>}
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>จำนวน *</Label>
            <Input type="number" min={0} step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} required />
          </div>
          <div className="space-y-1.5">
            <Label>หมายเหตุ</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" variant="ink" disabled={submitting}>{submitting ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
