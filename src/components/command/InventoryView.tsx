import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Boxes, Inbox, RefreshCcw, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { inr } from "./format";

type Row = NonNullable<ReturnType<typeof useQuery<typeof api.queries.getInventory>>>[number];

function stockStatus(row: Row): { label: string; cls: string } {
  const inv = row.inventory;
  if (!inv) return { label: "Unknown", cls: "text-muted-foreground" };
  const total = inv.available + inv.reserved + inv.incoming;
  if (inv.available <= 0 && total === 0) return { label: "Out", cls: "border-rose-500/25 bg-rose-500/10 text-rose-600" };
  if (inv.available <= 0) return { label: "Out", cls: "border-rose-500/25 bg-rose-500/10 text-rose-600" };
  if (inv.available <= row.reorderLevel / 2) return { label: "Critical", cls: "border-rose-500/25 bg-rose-500/10 text-rose-600" };
  if (inv.available <= row.reorderLevel) return { label: "Low", cls: "border-amber-500/25 bg-amber-500/10 text-amber-600" };
  return { label: "Healthy", cls: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600" };
}

function suggestedQty(row: Row): number {
  const inv = row.inventory;
  const have = inv ? inv.available + inv.incoming : 0;
  const target = row.avgDailyDemand * (row.leadTimeDays + 7);
  return Math.max(10, Math.ceil((target - have) / 10) * 10);
}

export function InventoryView() {
  const rows = useQuery(api.queries.getInventory);
  const reorders = useQuery(api.queries.getReorders);
  const createReorder = useMutation(api.ops.createReorder);

  const [query, setQuery] = useState("");
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (onlyAtRisk) {
          const inv = r.inventory;
          if (!inv || inv.available > r.reorderLevel) return false;
        }
        if (!q) return true;
        return (
          r.sku.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const atRisk = (r: Row) => (r.inventory && r.inventory.available <= r.reorderLevel ? 0 : 1);
        return atRisk(a) - atRisk(b) || (a.inventory?.available ?? 0) / Math.max(1, a.avgDailyDemand) - (b.inventory?.available ?? 0) / Math.max(1, b.avgDailyDemand);
      });
  }, [rows, query, onlyAtRisk]);

  const handleReorder = async (row: Row) => {
    try {
      await createReorder({ productId: row._id, quantity: suggestedQty(row) });
      toast.success(`Purchase order created — ${suggestedQty(row)} units of ${row.sku}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reorder failed");
    }
  };

  if (!rows) {
    return <div className="flex h-[50vh] items-center justify-center text-xs text-muted-foreground">Loading inventory…</div>;
  }

  const atRiskCount = rows.filter((r) => r.inventory && r.inventory.available <= r.reorderLevel).length;
  const totalValue = rows.reduce((s, r) => s + (r.inventory?.available ?? 0) * r.price, 0);
  const pendingReorders = reorders?.filter((r) => r.status === "Pending").length ?? 0;

  return (
    <div className="space-y-4">
      {/* summary strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={<Boxes className="size-4.5" />} iconClass="bg-sky-500/10 text-sky-600" label="SKUs tracked" value={`${rows.length}`} />
        <SummaryCard
          icon={<TriangleAlert className="size-4.5" />}
          iconClass={atRiskCount > 0 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}
          label="At/below reorder point"
          value={`${atRiskCount}`}
        />
        <SummaryCard
          icon={<Inbox className="size-4.5" />}
          iconClass="bg-violet-500/10 text-violet-600"
          label="Pending reorders"
          value={`${pendingReorders}`}
        />
        <SummaryCard icon={<RefreshCcw className="size-4.5" />} iconClass="bg-emerald-500/10 text-emerald-600" label="Stock value (available)" value={inr(Math.round(totalValue))} />
      </div>

      {/* toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search SKU, name, zone…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <button
          type="button"
          onClick={() => setOnlyAtRisk((v) => !v)}
          className={cn(
            "self-start rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            onlyAtRisk ? "border-amber-500/40 bg-amber-500/10 text-amber-600" : "text-muted-foreground hover:bg-accent",
          )}
        >
          At-risk only
        </button>
      </div>

      {/* table */}
      <Card className="overflow-hidden shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Incoming</th>
                <th className="px-4 py-3 text-right">Reorder pt.</th>
                <th className="px-4 py-3 text-right">Days cover</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.slice(0, 80).map((r) => {
                const inv = r.inventory;
                const available = inv?.available ?? 0;
                const cover = available / Math.max(1, r.avgDailyDemand);
                const st = stockStatus(r);
                const pctOfReorder = Math.min(100, (available / Math.max(1, r.reorderLevel)) * 100);
                return (
                  <tr key={r._id} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-[9px] font-bold text-primary">
                          {r.category.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium">{r.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {r.sku} · {r.category}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                        {r.zone}·{r.location}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn("font-semibold", available <= 0 ? "text-rose-500" : available <= r.reorderLevel ? "text-amber-600" : "")}>
                        {available}
                      </span>
                      <div className="mx-auto mt-1 h-1 w-14 overflow-hidden rounded-full bg-primary/10">
                        <div
                          className={cn("h-full rounded-full", available <= 0 ? "bg-rose-500" : available <= r.reorderLevel / 2 ? "bg-amber-500" : "bg-sky-500")}
                          style={{ width: `${pctOfReorder}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{inv?.reserved ?? 0}</td>
                    <td className="px-4 py-2.5 text-right">
                      {inv && inv.incoming > 0 ? (
                        <span className="font-medium text-violet-600">+{inv.incoming}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{r.reorderLevel}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn("font-medium", cover < 2 ? "text-rose-500" : cover < r.leadTimeDays ? "text-amber-600" : "")}>
                        {cover.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={st.cls}>
                        {st.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {inv && available <= r.reorderLevel ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() => void handleReorder(r)}
                        >
                          <RefreshCcw className="size-3" /> Reorder {suggestedQty(r)}
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    No SKUs match this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {reorders && reorders.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent reorders
            </h2>
            <div className="flex flex-wrap gap-2">
              {reorders.slice(0, 8).map((r) => (
                <Badge key={r._id} variant="outline" className="gap-1.5 border-violet-500/25 bg-violet-500/[0.06] py-1.5 font-normal">
                  <RefreshCcw className="size-3 text-violet-500" />
                  {r.product?.sku} · {r.quantity} units
                  <span className="text-muted-foreground">· {r.status}</span>
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  iconClass,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
}) {
  return (
    <Card className="shadow-none">
      <div className="flex items-center gap-3 p-4">
        <div className={`flex size-9 items-center justify-center rounded-lg ${iconClass}`}>{icon}</div>
        <div>
          <div className="font-display text-lg font-bold leading-tight">{value}</div>
          <div className="text-[11px] text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}
