import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/lib/firestore-hooks";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import type { Product } from "@/lib/firebase";

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const { profile } = useAuth();
  const { data: products, loading } = useProducts();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const canEdit = profile?.role === "owner" || profile?.role === "manager";

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.category.toLowerCase().includes(s)
    );
  }, [products, search]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">สินค้า</h1>
          <p className="text-sm text-muted-foreground">รายการวัตถุดิบทั้งหมด</p>
        </div>
        {canEdit && (
          <Button variant="ink" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> เพิ่มสินค้า
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาสินค้า / รหัส / หมวด" className="pl-9 h-11" />
      </div>

      <div className="card-soft divide-y divide-border">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">ยังไม่มีสินค้า — เริ่มจากเพิ่มรายการแรก</div>
        ) : filtered.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                {p.sku && <>SKU: {p.sku} · </>}{p.category || "ไม่ระบุหมวด"} · ขั้นต่ำ {p.minStock} {p.unit}
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={async () => {
                  if (confirm(`ลบสินค้า "${p.name}"?`)) await supabase.from("products").delete().eq("id", p.id);
                }}>
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

function ProductDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Product | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    sku: editing?.sku ?? "",
    unit: editing?.unit ?? "กก.",
    category: editing?.category ?? "",
    minStock: editing?.minStock ?? 0,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.name.trim() || !form.sku.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        unit: form.unit.trim() || "หน่วย",
        category: form.category.trim() || null,
        min_stock: Number(form.minStock) || 0,
      };
      if (editing) {
        await supabase.from("products").update(payload).eq("id", editing.id);
      } else {
        await supabase.from("products").insert(payload);
      }
      onOpenChange(false);
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (v) setForm({
        name: editing?.name ?? "",
        sku: editing?.sku ?? "",
        unit: editing?.unit ?? "กก.",
        category: editing?.category ?? "",
        minStock: editing?.minStock ?? 0,
      });
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>ชื่อสินค้า *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>รหัส SKU *</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>หน่วย</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="กก. / ขวด / ชิ้น" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>หมวดหมู่</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="เนื้อสัตว์ / ผัก / เครื่องดื่ม" />
            </div>
            <div className="space-y-1.5">
              <Label>สต๊อกขั้นต่ำ</Label>
              <Input type="number" min={0} value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" variant="ink" disabled={submitting}>
              {submitting ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
