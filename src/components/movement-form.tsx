import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/lib/auth-context";
import { useProducts, useStock } from "@/lib/firestore-hooks";
import { stockIn, stockOut, transferStock } from "@/lib/inventory";
import { BRANCHES, branchName, type BranchId } from "@/lib/firebase";
import { Check, ChevronsUpDown, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "IN" | "OUT" | "TRANSFER";

export function MovementForm({ mode }: { mode: Mode }) {
  const { profile } = useAuth();
  const { data: products } = useProducts();
  const isOwnerOrManager = profile?.role === "owner" || profile?.role === "manager";

  // pick default branch
  const defaultBranch: BranchId = (profile?.branchId ?? "central-kitchen") as BranchId;
  const [branchId, setBranchId] = useState<BranchId>(defaultBranch);
  const [toBranchId, setToBranchId] = useState<BranchId>(
    BRANCHES.find((b) => b.id !== defaultBranch)?.id ?? "yukata-shabu",
  );
  const [productId, setProductId] = useState<string>("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [quantity, setQuantity] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Lock branch for staff/manager (only owner can choose source)
  const canChooseSource = profile?.role === "owner";

  const { data: stock } = useStock(branchId);
  const stockMap = useMemo(() => new Map(stock.map((s) => [s.productId, s.quantity])), [stock]);
  const product = products.find((p) => p.id === productId) ?? null;
  const currentQty = product ? stockMap.get(product.id) ?? 0 : 0;

  const meta = {
    IN: { title: "รับเข้าสต๊อก", subtitle: "เพิ่มวัตถุดิบเข้าสาขา", icon: ArrowDownToLine, color: "ink" as const, action: "บันทึกรับเข้า" },
    OUT: { title: "เบิกออก", subtitle: "ตัดสต๊อกออกจากสาขา", icon: ArrowUpFromLine, color: "brass" as const, action: "บันทึกเบิกออก" },
    TRANSFER: { title: "โอนย้ายระหว่างสาขา", subtitle: "ย้ายสต๊อกจากต้นทางไปปลายทาง", icon: ArrowLeftRight, color: "ink" as const, action: "บันทึกโอนย้าย" },
  }[mode];
  const Icon = meta.icon;

  const reset = () => {
    setQuantity("");
    setNote("");
    setProductId("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null); setSuccess(null);

    if (!product) { setError("กรุณาเลือกสินค้า"); return; }
    const qty = Number(quantity);
    if (!qty || qty <= 0) { setError("จำนวนต้องมากกว่า 0"); return; }
    if (mode === "TRANSFER" && !isOwnerOrManager) { setError("ไม่มีสิทธิ์โอนย้าย"); return; }

    setSubmitting(true);
    try {
      const base = {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        note: note.trim(),
        createdBy: profile!.uid,
        createdByName: profile!.name,
      };
      if (mode === "IN") await stockIn({ ...base, branchId });
      else if (mode === "OUT") await stockOut({ ...base, branchId });
      else await transferStock({ ...base, fromBranchId: branchId, toBranchId });

      setSuccess(`บันทึกสำเร็จ · ${product.name} ${qty} ${product.unit}`);
      reset();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className={cn("h-12 w-12 grid place-items-center rounded-2xl text-primary-foreground",
          meta.color === "ink" ? "ink-gradient" : "brass-gradient text-accent-foreground")}>
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="card-soft p-5 space-y-4">
        {/* Source branch */}
        <div className="space-y-1.5">
          <Label>{mode === "TRANSFER" ? "สาขาต้นทาง" : "สาขา"}</Label>
          {canChooseSource ? (
            <Select value={branchId} onValueChange={(v) => setBranchId(v as BranchId)}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BRANCHES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-12 px-3 rounded-lg border border-border bg-secondary/40 flex items-center text-sm">
              {branchName(branchId)}
            </div>
          )}
        </div>

        {mode === "TRANSFER" && (
          <div className="space-y-1.5">
            <Label>สาขาปลายทาง</Label>
            <Select value={toBranchId} onValueChange={(v) => setToBranchId(v as BranchId)}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BRANCHES.filter((b) => b.id !== branchId).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Product picker */}
        <div className="space-y-1.5">
          <Label>สินค้า</Label>
          <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="h-12 w-full justify-between font-normal">
                {product ? (
                  <span className="truncate text-left">{product.name}
                    <span className="text-muted-foreground text-xs ml-2">({product.unit})</span>
                  </span>
                ) : <span className="text-muted-foreground">เลือกสินค้า...</span>}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
              <Command>
                <CommandInput placeholder="ค้นหาสินค้า..." />
                <CommandList>
                  <CommandEmpty>ไม่พบสินค้า</CommandEmpty>
                  <CommandGroup>
                    {products.map((p) => (
                      <CommandItem key={p.id} value={`${p.name} ${p.sku}`}
                        onSelect={() => { setProductId(p.id); setProductPickerOpen(false); }}>
                        <Check className={cn("h-4 w-4 mr-2", productId === p.id ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.unit}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {product && (
            <div className="text-xs text-muted-foreground">
              คงเหลือปัจจุบันที่{branchName(branchId)}: <span className="font-semibold text-foreground tabular-nums">
                {currentQty.toLocaleString("th-TH")}</span> {product.unit}
            </div>
          )}
        </div>

        {/* Quantity */}
        <div className="space-y-1.5">
          <Label>จำนวน</Label>
          <div className="flex gap-2">
            <Input type="number" inputMode="decimal" min={0} step="any" value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-14 text-xl tabular-nums font-semibold" placeholder="0" />
            <div className="h-14 px-4 rounded-lg border border-border bg-secondary/40 grid place-items-center text-sm font-medium min-w-[64px]">
              {product?.unit ?? "—"}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap pt-1">
            {[1, 5, 10, 20, 50].map((n) => (
              <button key={n} type="button"
                onClick={() => setQuantity(String((Number(quantity) || 0) + n))}
                className="px-3 h-8 text-xs rounded-lg border border-border bg-card hover:bg-secondary">
                +{n}
              </button>
            ))}
            <button type="button" onClick={() => setQuantity("")}
              className="px-3 h-8 text-xs rounded-lg text-muted-foreground hover:text-foreground">ล้าง</button>
          </div>
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <Label>หมายเหตุ (ไม่บังคับ)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder="เช่น เลขใบเสร็จ / ชื่อผู้ส่ง" />
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>
        )}
        {success && (
          <div className="text-sm text-success-foreground bg-success/15 border border-success/30 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {success}
          </div>
        )}

        <Button type="submit" variant={meta.color} size="xl" disabled={submitting || !product} className="w-full">
          {submitting ? "กำลังบันทึก..." : meta.action}
        </Button>
      </form>
    </div>
  );
}
