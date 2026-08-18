import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { InventoryStatusBadge, OrderStatusBadge, PriorityBadge } from "./badges";
import { deadlineTone, hoursLeft, inr, timeAgo } from "./format";

type Order = NonNullable<ReturnType<typeof useQuery<typeof api.queries.getOrders>>>[number];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "inflight", label: "In flight" },
  { key: "ready", label: "Ready" },
  { key: "risk", label: "Risk" },
  { key: "done", label: "Done" },
] as const;

export function OrdersView() {
  const orders = useQuery(api.queries.getOrders);
  const dispatchOrder = useMutation(api.ops.dispatchOrder);
  const delayOrder = useMutation(api.ops.delayOrder);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [delayOpen, setDelayOpen] = useState(false);
  const [delayReason, setDelayReason] = useState("Carrier cut-off missed — manual override");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!orders) return [];
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (filter === "inflight" && !["Completed", "Dispatched"].includes(o.status)) return true;
        if (filter === "ready" && o.status === "Ready to Dispatch") return true;
        if (filter === "risk" && (o.status === "Exception" || o.status === "Delayed" || o.inventoryStatus === "Shortage" || o.inventoryStatus === "Out")) return true;
        if (filter === "done" && (o.status === "Completed" || o.status === "Dispatched")) return true;
        return filter === "all";
      })
      .filter((o) => {
        if (!q) return true;
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          (o.customer?.name ?? "").toLowerCase().includes(q) ||
          o.items.some((i) => (i.product?.sku ?? "").toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const risk = (o: Order) => (o.status === "Exception" || o.status === "Delayed" ? 1 : 0);
        return risk(b) - risk(a) || b.priorityScore - a.priorityScore;
      });
  }, [orders, filter, query]);

  const handleDispatch = async (o: Order) => {
    setBusy(true);
    try {
      await dispatchOrder({ orderId: o._id });
      toast.success(`${o.orderNumber} dispatched — fulfillment confirmed`);
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dispatch failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelay = async (o: Order) => {
    setBusy(true);
    try {
      await delayOrder({ orderId: o._id, reason: delayReason });
      toast.warning(`${o.orderNumber} delayed — exception + AI decision created`);
      setDelayOpen(false);
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delay order");
    } finally {
      setBusy(false);
    }
  };

  if (!orders) {
    return <div className="flex h-[50vh] items-center justify-center text-xs text-muted-foreground">Loading orders…</div>;
  }

  const selectedDetail = selected;

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count =
              f.key === "all"
                ? orders.length
                : f.key === "inflight"
                  ? orders.filter((o) => !["Completed", "Dispatched"].includes(o.status)).length
                  : f.key === "ready"
                    ? orders.filter((o) => o.status === "Ready to Dispatch").length
                    : f.key === "risk"
                      ? orders.filter((o) => o.status === "Exception" || o.status === "Delayed" || o.inventoryStatus === "Shortage" || o.inventoryStatus === "Out").length
                      : orders.filter((o) => o.status === "Completed" || o.status === "Dispatched").length;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {f.label} <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search order, customer, SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* table */}
      <Card className="overflow-hidden shadow-none">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                    No orders match this view.
                  </TableCell>
                </TableRow>
              )}
              {filtered.slice(0, 60).map((o) => {
                const tone = deadlineTone(o.deadline);
                const itemsTotal = o.items.reduce((s, i) => s + i.qty, 0);
                const allocatedTotal = o.items.reduce((s, i) => s + i.allocated, 0);
                const partial = allocatedTotal < itemsTotal;
                return (
                  <TableRow
                    key={o._id}
                    className="cursor-pointer"
                    onClick={() => setSelected(o)}
                  >
                    <TableCell>
                      <div className="font-mono text-[13px] font-semibold">{o.orderNumber}</div>
                      <div className="text-[11px] text-muted-foreground">{timeAgo(o.createdAt)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] font-medium">{o.customer?.name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {o.customer?.tier ?? ""} · {o.customer?.city ?? ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{inr(o.value)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <PriorityBadge level={o.priorityLevel} className="px-2 py-0 text-[10px]" />
                        <span className="text-[10px] text-muted-foreground">{o.priorityScore}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <OrderStatusBadge status={o.status} className="px-2 py-0 text-[10px]" />
                        {partial && o.status !== "Completed" && o.status !== "Dispatched" && (
                          <InventoryStatusBadge status={o.inventoryStatus} className="px-2 py-0 text-[10px]" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs font-medium",
                          tone === "critical" && "text-rose-500",
                          tone === "warning" && "text-amber-600",
                          tone === "ok" && "text-muted-foreground",
                        )}
                      >
                        <Clock3 className="size-3" /> {hoursLeft(o.deadline)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-[11px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(o);
                        }}
                      >
                        View <ArrowRight className="size-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* detail dialog */}
      <Dialog open={!!selectedDetail} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          {selectedDetail && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 pr-8">
                  <DialogTitle className="font-mono text-lg">{selectedDetail.orderNumber}</DialogTitle>
                  <OrderStatusBadge status={selectedDetail.status} />
                  <PriorityBadge level={selectedDetail.priorityLevel} />
                </div>
                <DialogDescription>
                  {selectedDetail.customer?.name} · {selectedDetail.customer?.tier} ·{" "}
                  {selectedDetail.customer?.city} · {inr(selectedDetail.value)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                {/* timeline */}
                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Fulfillment timeline
                  </div>
                  <div className="flex items-start">
                    {selectedDetail.timeline.map((t, i) => (
                      <div key={t.key} className="flex flex-1 flex-col items-center">
                        <div className="relative flex flex-col items-center">
                          <div
                            className={cn(
                              "flex size-5 items-center justify-center rounded-full border-2",
                              t.state === "done" && "border-emerald-500 bg-emerald-500/15 text-emerald-600",
                              t.state === "partial" && "border-amber-500 bg-amber-500/15 text-amber-600",
                              t.state === "pending" && "border-border bg-background text-muted-foreground/40",
                            )}
                          >
                            {t.state === "done" ? (
                              <CheckCircle2 className="size-3" />
                            ) : t.state === "partial" ? (
                              <AlertTriangle className="size-3" />
                            ) : null}
                          </div>
                          {i < selectedDetail.timeline.length - 1 && (
                            <span
                              className={cn(
                                "absolute left-5 top-2.5 h-0.5 w-full",
                                t.state === "pending" ? "bg-border" : "bg-emerald-500/60",
                              )}
                            />
                          )}
                        </div>
                        <div className="mt-2 px-0.5 text-center">
                          <div className={cn("text-[10px] font-semibold leading-tight", t.state === "pending" ? "text-muted-foreground/60" : "")}>
                            {t.label}
                          </div>
                          {t.state !== "pending" && (
                            <div className="mt-0.5 text-[9px] text-muted-foreground/70">{timeAgo(t.at)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedDetail.timeline.some((t) => t.note) && (
                    <div className="mt-3 space-y-1 rounded-lg bg-amber-500/[0.06] p-3">
                      {selectedDetail.timeline
                        .filter((t) => t.note)
                        .map((t) => (
                          <p key={t.key} className="text-[11px] text-amber-700 dark:text-amber-300">
                            <span className="font-semibold">{t.label}:</span> {t.note}
                          </p>
                        ))}
                    </div>
                  )}
                </div>

                {/* priority reasons */}
                <div className="rounded-xl border p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Why this priority — score {selectedDetail.priorityScore}/100
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedDetail.priorityReasons.map((r, i) => (
                      <Badge key={i} variant="secondary" className="font-mono text-[10px]">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* items */}
                <div className="rounded-xl border">
                  <div className="border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Items ({selectedDetail.items.length})
                  </div>
                  <div className="divide-y">
                    {selectedDetail.items.map((it) => (
                      <div key={it.productId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium">
                            {it.product?.name ?? "Product"}
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">{it.product?.sku}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {it.product?.location ?? ""} · Zone {it.product?.zone ?? ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[13px] font-semibold">
                            {it.allocated}/{it.qty} <span className="text-[10px] font-normal text-muted-foreground">allocated</span>
                          </div>
                          <div className={cn("text-[10px]", it.allocated < it.qty ? "text-amber-600" : "text-emerald-600")}>
                            {it.allocated < it.qty ? "short" : "fulfilled"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* actions */}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {selectedDetail.status === "Ready to Dispatch" && (
                    <Button onClick={() => void handleDispatch(selectedDetail)} disabled={busy} className="gap-1.5">
                      <Truck className="size-4" /> Dispatch now
                    </Button>
                  )}
                  {!["Completed", "Dispatched"].includes(selectedDetail.status) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDelayReason("Carrier cut-off missed — manual override");
                        setDelayOpen(true);
                      }}
                      disabled={busy}
                      className="gap-1.5 text-amber-600"
                    >
                      <Clock3 className="size-4" /> Mark delayed
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* delay dialog */}
      <Dialog open={delayOpen} onOpenChange={setDelayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delay order {selectedDetail?.orderNumber}</DialogTitle>
            <DialogDescription>
              This creates an open exception and an AI decision recommending how to recover the SLA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <PackageCheck className="size-4 shrink-0" />
              The AI engine will recommend dispatching with the next carrier slot or offering self-pickup.
            </div>
            <Textarea
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              placeholder="Reason for the delay…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelayOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedDetail && void handleDelay(selectedDetail)}
              disabled={busy || !delayReason.trim()}
            >
              Confirm delay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
