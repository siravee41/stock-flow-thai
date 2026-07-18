import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranches, type BranchDoc } from "@/lib/crud-hooks";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Store } from "lucide-react";

export const Route = createFileRoute("/_app/branches")({ component: BranchesPage });

function BranchesPage() {
  const { profile } = useAuth();
  const { data, loading } = useBranches();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BranchDoc | null>(null);
  const canEdit = profile?.role === "owner";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">สาขา</h1>
          <p className="text-sm text-muted-foreground">จัดการสาขา / ครัวกลาง</p>
        </div>
        {canEdit && (
          <Button variant="ink" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> เพิ่มสาขา
          </Button>
        )}
      </div>
      <div className="card-soft divide-y divide-border">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">กำลังโหลด...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">ยังไม่มีสาขา</div>
        ) : data.map((b) => (
          <div key={b.id} className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-10 w-10 grid place-items-center rounded-xl bg-secondary"><Store className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="font-medium truncate">{b.name}</div>
                <div className="text-xs text-muted-foreground">ID: {b.id}{b.short_name ? ` · ${b.short_name}` : ""}</div>
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(b); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={async () => {
                  if (confirm(`ลบสาขา "${b.name}"?`)) await supabase.from("branches").delete().eq("id", b.id);
                }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <BranchDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `branch-${Date.now()}`;
}

function BranchDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: BranchDoc | null }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [shortName, setShortName] = useState(editing?.short_name ?? "");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !name.trim()) return;
    setSubmitting(true);
    try {
      if (editing) {
        await supabase.from("branches").update({ name: name.trim(), short_name: shortName.trim() || null }).eq("id", editing.id);
      } else {
        await supabase.from("branches").insert({ id: slugify(name), name: name.trim(), short_name: shortName.trim() || null });
      }
      onOpenChange(false);
      setName(""); setShortName("");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (v) { setName(editing?.name ?? ""); setShortName(editing?.short_name ?? ""); }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "แก้ไขสาขา" : "เพิ่มสาขาใหม่"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>ชื่อสาขา *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>ชื่อย่อ (ภาษาไทย)</Label>
            <Input value={shortName ?? ""} onChange={(e) => setShortName(e.target.value)} />
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
