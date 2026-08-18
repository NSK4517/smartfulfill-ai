import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  History,
  PackageOpen,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { SeverityBadge } from "./badges";
import { timeAgo } from "./format";

const TYPE_ICONS: Record<string, { icon: React.ElementType; cls: string }> = {
  "Stock shortage": { icon: PackageOpen, cls: "text-rose-500 bg-rose-500/10" },
  "Stockout": { icon: PackageOpen, cls: "text-rose-500 bg-rose-500/10" },
  "Damaged item": { icon: AlertTriangle, cls: "text-rose-500 bg-rose-500/10" },
  "Missing item": { icon: PackageOpen, cls: "text-amber-500 bg-amber-500/10" },
  "QC failure": { icon: ShieldCheck, cls: "text-violet-500 bg-violet-500/10" },
  "Picking failure": { icon: Clock3, cls: "text-amber-500 bg-amber-500/10" },
  "Picking delay": { icon: Clock3, cls: "text-amber-500 bg-amber-500/10" },
  "Packing error": { icon: PackageOpen, cls: "text-amber-500 bg-amber-500/10" },
  "Dispatch delay": { icon: Clock3, cls: "text-amber-500 bg-amber-500/10" },
  "Allocation conflict": { icon: BrainCircuit, cls: "text-violet-500 bg-violet-500/10" },
};

export function ExceptionsView() {
  const exceptions = useQuery(api.queries.getExceptions);
  const resolveException = useMutation(api.ops.resolveException);

  const [resolveOpen, setResolveOpen] = useState<Id<"exceptions"> | null>(null);
  const [resolution, setResolution] = useState("");

  if (!exceptions) {
    return <div className="flex h-[50vh] items-center justify-center text-xs text-muted-foreground">Loading exceptions…</div>;
  }

  const open = exceptions.filter((e) => e.status === "Open");
  const resolved = exceptions.filter((e) => e.status === "Resolved");

  const handleResolve = async (id: Id<"exceptions">) => {
    try {
      await resolveException({ exceptionId: id, resolution: resolution || "Resolved by operator." });
      toast.success("Exception resolved");
      setResolveOpen(null);
      setResolution("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resolve");
    }
  };

  return (
    <div className="space-y-5">
      {/* open queue */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Open exceptions
        </h2>
        {open.length > 0 && (
          <Badge variant="outline" className="border-rose-500/25 bg-rose-500/10 text-rose-600">
            {open.length} open
          </Badge>
        )}
      </div>

      {open.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="size-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">All clear</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                No open exceptions. The decision engine is standing watch.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {open.map((e) => {
            const meta = TYPE_ICONS[e.type] ?? { icon: AlertTriangle, cls: "text-amber-500 bg-amber-500/10" };
            const Icon = meta.icon;
            return (
              <Card key={e._id} className="overflow-hidden shadow-none">
                <CardContent className="p-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-9 items-center justify-center rounded-lg ${meta.cls}`}>
                        <Icon className="size-4.5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-rose-600">{e.exceptionId}</span>
                          <Badge variant="outline" className="border-slate-400/25 bg-slate-400/10 text-slate-500">
                            {e.type}
                          </Badge>
                          <SeverityBadge severity={e.severity} className="px-2 py-0 text-[10px]" />
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {timeAgo(e.createdAt)}
                          {e.order && <> · {e.order.orderNumber}</>}
                          {e.product && <> · {e.product.sku}</>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Problem</div>
                        <p className="mt-1 text-[13px] leading-relaxed">{e.description}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Impact</div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{e.impact}</p>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-4 lg:border-l lg:pl-5">
                      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-600">
                          <BrainCircuit className="size-3.5" /> AI Recommendation
                        </div>
                        <p className="mt-2 text-[13px] leading-relaxed">{e.aiRecommendation}</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          {e.decisionHistory.map((h, i) => (
                            <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              {i > 0 && <span className="text-border">→</span>}
                              <span className="rounded bg-muted px-1.5 py-0.5">{h.stage}</span>
                            </span>
                          ))}
                        </div>
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-emerald-600" onClick={() => setResolveOpen(e._id)}>
                          <CheckCircle2 className="size-3.5" /> Resolve
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* resolved history */}
      {resolved.length > 0 && (
        <>
          <h2 className="flex items-center gap-2 pt-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <History className="size-4" /> Resolved ({resolved.length})
          </h2>
          <Card className="overflow-hidden shadow-none">
            {resolved.slice(0, 10).map((e) => (
              <div key={e._id} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground">{e.exceptionId}</span>
                    <Badge variant="outline" className="border-slate-400/25 bg-slate-400/10 px-1.5 py-0 text-[10px] text-slate-500">
                      {e.type}
                    </Badge>
                    {e.order && <span className="text-[11px] text-muted-foreground">{e.order.orderNumber}</span>}
                  </div>
                  {e.resolution && <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.resolution}</p>}
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(e.resolvedAt ?? e.createdAt)}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* resolve dialog */}
      <Dialog open={resolveOpen !== null} onOpenChange={(o) => !o && setResolveOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve exception</DialogTitle>
            <DialogDescription>Record how this exception was resolved — the note is added to the audit trail.</DialogDescription>
          </DialogHeader>
          <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. Re-picked from Zone A and passed QC…" rows={3} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolveOpen(null)}>Cancel</Button>
            <Button onClick={() => resolveOpen && void handleResolve(resolveOpen)}>Confirm resolution</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
