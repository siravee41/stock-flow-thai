import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useProductsCrud, type ProductCrud } from "@/lib/crud-hooks";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/catalog")({ component: CatalogPage });

function CatalogPage() {
  const { profile } = useAuth();
  const { data, loading } = useProductsCrud();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCrud | null>(null);
  const canEdit = profile?.role === "owner" || profile?.role === "manager";

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter((p) => p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s) || p.category.toLowerCase().includes(s));
  }, [data, search]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">แคตตาล็อกสินค้า</h1>
          <p className="text-sm text-muted-foreground">collection: products_v2</p>
        </div>
        {canEdit && (
          <Button variant="ink" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> เพิ่มสินค้า
          </Button>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา code / ชื่อ / หมวด" className="pl-9 h-11" />
      </div>
      <div className="card-soft divide-y divide-border">
        {loading ? <div className="p-6 text-center text-muted-foreground text-sm">กำลังโหลด...</div>
          : filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">ยังไม่มีสินค้า</div>
          : filtered.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{p.name} <span className="text-xs text-muted-foreground">#{p.code}</span></div>
                <div className="text-xs text-muted-foreground">{p.category || "—"} · ขั้นต่ำ {p.min_stock} {p.unit}</div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={async () => { if (confirm(`ลบ "${p.name}"?`)) await deleteDoc(doc(db, "products_v2", p.id)); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
      </div>
      <ProductDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function ProductDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: ProductCrud | null }) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: editing?.code ?? "", name: editing?.name ?? "", unit: editing?.unit ?? "กก.",
    category: editing?.category ?? "", min_stock: editing?.min_stock ?? 0,
  });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !form.name.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(), name: form.name.trim(), unit: form.unit.trim() || "หน่วย",
        category: form.category.trim(), min_stock: Number(form.min_stock) || 0,
      };
      if (editing) await updateDoc(doc(db, "products_v2", editing.id), payload);
      else await addDoc(collection(db, "products_v2"), { ...payload, created_at: Date.now() });
      onOpenChange(false);
    } finally { setSubmitting(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (v) setForm({
        code: editing?.code ?? "", name: editing?.name ?? "", unit: editing?.unit ?? "กก.",
        category: editing?.category ?? "", min_stock: editing?.min_stock ?? 0,
      });
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>รหัส (code) *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>หน่วย</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>ชื่อสินค้า *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>หมวดหมู่</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>ขั้นต่ำ</Label><Input type="number" min={0} value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} /></div>
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
