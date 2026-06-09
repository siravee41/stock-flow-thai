import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTransactions } from "@/lib/firestore-hooks";
import { BRANCHES, branchName, type BranchId } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from "lucide-react";

export const Route = createFileRoute("/_app/history")({ component: HistoryPage });

function HistoryPage() {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const [branchFilter, setBranchFilter] = useState<string>(isOwner ? "all" : (profile?.branchId ?? "all"));
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const branchArg = branchFilter === "all" ? null : branchFilter;
  const { data: txs } = useTransactions({ branchId: branchArg, limit: 500 });

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return t.productName.toLowerCase().includes(q) || (t.createdByName ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [txs, typeFilter, search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ประวัติธุรกรรม</h1>
        <p className="text-sm text-muted-foreground">บันทึกทุกการเคลื่อนไหวของสต๊อก</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาสินค้า / ผู้บันทึก" className="pl-9 h-11" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            <SelectItem value="IN">รับเข้า</SelectItem>
            <SelectItem value="OUT">เบิกออก</SelectItem>
            <SelectItem value="TRANSFER">โอนย้าย</SelectItem>
          </SelectContent>
        </Select>
        {isOwner ? (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสาขา</SelectItem>
              {BRANCHES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div className="h-11 px-3 rounded-lg border border-border bg-secondary/40 flex items-center text-sm">
            {branchName(profile?.branchId ?? "")}
          </div>
        )}
      </div>

      <div className="card-soft divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">ไม่มีรายการ</div>
        ) : filtered.map((t) => {
          const Icon = t.type === "IN" ? ArrowDownToLine : t.type === "OUT" ? ArrowUpFromLine : ArrowLeftRight;
          const tone = t.type === "IN" ? "bg-success/15 text-success-foreground" : t.type === "OUT" ? "bg-destructive/10 text-destructive" : "bg-accent/20 text-accent-foreground";
          const sign = t.type === "IN" ? "+" : t.type === "OUT" ? "−" : "↔";
          const typeLabel = t.type === "IN" ? "รับเข้า" : t.type === "OUT" ? "เบิกออก" : "โอนย้าย";
          return (
            <div key={t.id} className="p-4 flex items-start gap-3">
              <span className={`h-10 w-10 grid place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium truncate">{t.productName}</div>
                  <div className={`text-base font-semibold tabular-nums ${t.type === "IN" ? "text-success" : t.type === "OUT" ? "text-destructive" : "text-foreground"}`}>
                    {sign}{t.quantity}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {typeLabel} · {t.type === "TRANSFER"
                    ? `${branchName(t.fromBranchId ?? "")} → ${branchName(t.toBranchId ?? "")}`
                    : branchName(t.branchId as BranchId)}
                  {" · คงเหลือ "} <span className="tabular-nums">{t.quantityBefore} → {t.quantityAfter}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  โดย {t.createdByName || "—"} · {new Date(t.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
                  {t.note && <> · {t.note}</>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
