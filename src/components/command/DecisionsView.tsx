import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Eye,
  Gauge,
  Package,
  Play,
  RefreshCcw,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
  XCircle,
  Zap,
} from "lucide-react";
import { DecisionStatusBadge, PriorityBadge } from "./badges";
import { inr, timeAgo } from "./format";

const TYPE_META: Record<string, { icon: React.ElementType; label: string; chip: string; iconClass: string }> = {
  allocation: { icon: Zap, label: "Smart Allocation", chip: "bg-amber-500/10 text-amber-600", iconClass: "bg-amber-500/15 text-amber-600" },
  reorder: { icon: RefreshCcw, label: "Replenishment", chip: "bg-sky-500/10 text-sky-600", iconClass: "bg-sky-500/15 text-sky-600" },
  bottleneck: { icon: Gauge, label: "Bottleneck", chip: "bg-amber-500/10 text-amber-600", iconClass: "bg-amber-500/15 text-amber-600" },
  damage: { icon: AlertTriangle, label: "Damaged Item", chip: "bg-rose-500/10 text-rose-600", iconClass: "bg-rose-500/15 text-rose-600" },
  dispatch: { icon: Truck, label: "Dispatch", chip: "bg-sky-500/10 text-sky-600", iconClass: "bg-sky-500/15 text-sky-600" },
  qc: { icon: ShieldCheck, label: "Quality Control", chip: "bg-violet-500/10 text-violet-600", iconClass: "bg-violet-500/15 text-violet-600" },
  packing: { icon: Package, label: "Packing", chip: "bg-cyan-500/10 text-cyan-600", iconClass: "bg-cyan-500/15 text-cyan-600" },
  picking: { icon: Route, label: "Picking", chip: "bg-blue-500/10 text-blue-600", iconClass: "bg-blue-500/15 text-blue-600" },
};

const SCENARIOS = [
  { id: 1, label: "Stock shortage", desc: "Fresh WH-204 conflict vs critical order" },
  { id: 2, label: "Critical order", desc: "Platinum customer, 1-hour deadline" },
  { id: 3, label: "Damaged item", desc: "KB-102 damaged during unloading" },
  { id: 4, label: "Zone bottleneck", desc: "Picking slowdown in Zone C" },
  { id: 5, label: "Dispatch delay", desc: "Carrier cut-off missed" },
];

type Decision = NonNullable<ReturnType<typeof useQuery<typeof api.queries.getDecisions>>>[number];

export function DecisionsView() {
  const decisions = useQuery(api.queries.getDecisions);
  const applyDecision = useMutation(api.ops.applyDecision);
  const overrideDecision = useMutation(api.ops.overrideDecision);
  const ignoreDecision = useMutation(api.ops.ignoreDecision);
  const runAllocation = useMutation(api.ops.runAllocation);
  const runScenario = useMutation(api.ops.runDemoScenario);

  const pending = (decisions ?? []).filter((d) => d.status === "Pending");
  const history = (decisions ?? []).filter((d) => d.status !== "Pending");

  if (!decisions) {
    return <div className="flex h-[50vh] items-center justify-center text-xs text-muted-foreground">Loading decision engine…</div>;
  }

  const handleApply = async (d: Decision) => {
    try {
      const res = await applyDecision({ decisionId: d._id });
      toast.success(res?.message ?? "Decision applied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply decision");
    }
  };

  const handleOverride = async (d: Decision) => {
    try {
      await overrideDecision({ decisionId: d._id });
      toast.info(`Decision ${d.decisionId} overridden by operator`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to override decision");
    }
  };

  const handleIgnore = async (d: Decision) => {
    try {
      await ignoreDecision({ decisionId: d._id });
      toast.info(`Decision ${d.decisionId} ignored`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleAllocation = async () => {
    const t = toast.loading("Running smart allocation…");
    try {
      const res = await runAllocation();
      toast.success(
        res.unfulfilled > 0
          ? `Allocation complete — ${res.unfulfilled} units remain unfulfilled (backordered).`
          : "Allocation complete — all demand fulfilled.",
        { id: t },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Allocation failed", { id: t });
    }
  };

  const handleScenario = async (id: number) => {
    const t = toast.loading(`Loading scenario ${id}…`);
    try {
      const res = await runScenario({ scenario: id });
      toast.success(res?.message ?? "Scenario loaded", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scenario failed", { id: t });
    }
  };

  return (
    <div className="space-y-5">
      {/* engine header */}
      <div className="flex flex-col gap-4 rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] via-transparent to-sky-500/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/15">
              <BrainCircuit className="size-5 text-violet-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-semibold">Rule-based intelligence</span>
                <Badge variant="outline" className="border-violet-500/25 bg-violet-500/10 text-violet-600">
                  <Sparkles className="mr-1 size-3" /> explainable
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Deterministic engine · LLM-ready architecture · every action is logged
              </p>
            </div>
          </div>
          <Button onClick={handleAllocation} className="gap-2">
            <Zap className="size-4" /> Run smart allocation
          </Button>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Play className="size-3" /> Demo scenarios:
          </span>
          {SCENARIOS.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-[11px]"
              title={s.desc}
              onClick={() => void handleScenario(s.id)}
            >
              {s.id}. {s.label}
            </Button>
          ))}
        </div>
      </div>

      {/* pending decisions */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pending decisions
        </h2>
        {pending.length > 0 && (
          <Badge variant="outline" className="border-violet-500/25 bg-violet-500/10 text-violet-600">
            {pending.length} awaiting review
          </Badge>
        )}
      </div>

      {pending.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="size-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">No pending decisions</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                The engine is watching. Trigger a demo scenario above or run an allocation to generate a decision.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.map((d) => {
            const meta = TYPE_META[d.type] ?? TYPE_META.allocation;
            const Icon = meta.icon;
            return (
              <Card key={d._id} className="overflow-hidden shadow-none">
                <CardContent className="p-0">
                  {/* header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-9 items-center justify-center rounded-lg ${meta.iconClass}`}>
                        <Icon className="size-4.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-violet-600">{d.decisionId}</span>
                          <Badge variant="outline" className={meta.chip}>
                            {meta.label}
                          </Badge>
                          <DecisionStatusBadge status={d.status} />
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Clock3 className="size-3" /> {timeAgo(d.createdAt)}
                          {d.order && (
                            <>
                              <span>·</span>
                              <span>{d.order.orderNumber}</span>
                              <PriorityBadge level={d.order.priorityLevel} className="px-1.5 py-0 text-[10px]" />
                            </>
                          )}
                          {d.product && (
                            <>
                              <span>·</span>
                              <span className="font-mono">{d.product.sku}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 lg:grid-cols-[1.2fr_1fr]">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold">{d.problem}</h3>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{d.analysis}</p>
                      </div>

                      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-600">
                          <BrainCircuit className="size-3.5" /> AI Recommendation
                        </div>
                        <p className="mt-2 text-[13.5px] leading-relaxed">{d.recommendation}</p>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Expected impact
                        </div>
                        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                          {d.expectedImpact.map((imp) => (
                            <div key={imp} className="flex items-start gap-2 rounded-lg border px-3 py-2">
                              <ArrowRight className="mt-0.5 size-3 shrink-0 text-sky-500" />
                              <span className="text-xs leading-relaxed">{imp}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-4 lg:border-l lg:pl-5">
                      <div className="space-y-2 text-xs">
                        {d.order && (
                          <InfoRow label="Order" value={`${d.order.orderNumber} · ${inr(d.order.value)}`} />
                        )}
                        {d.product && (
                          <InfoRow label="Product" value={`${d.product.name} (${d.product.sku}) · ${d.product.category}`} />
                        )}
                        {d.order && (
                          <InfoRow label="Deadline" value={new Date(d.order.deadline).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })} />
                        )}
                        {d.order && (
                          <InfoRow label="Status" value={d.order.status} />
                        )}
                      </div>

                      <div className="grid gap-2">
                        <Button onClick={() => void handleApply(d)} className="w-full gap-1.5">
                          <Zap className="size-3.5" /> Apply recommendation
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" onClick={() => void handleOverride(d)} className="gap-1.5">
                            <Eye className="size-3.5" /> Override
                          </Button>
                          <Button variant="ghost" onClick={() => void handleIgnore(d)} className="gap-1.5 text-muted-foreground">
                            <XCircle className="size-3.5" /> Ignore
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* decision history */}
      {history.length > 0 && (
        <>
          <h2 className="pt-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Decision history
          </h2>
          <div className="rounded-xl border bg-card">
            {history.slice(0, 12).map((d) => {
              const meta = TYPE_META[d.type] ?? TYPE_META.allocation;
              const Icon = meta.icon;
              return (
                <div key={d._id} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-violet-600">{d.decisionId}</span>
                      <DecisionStatusBadge status={d.status} />
                      {d.order && <span className="text-[11px] text-muted-foreground">{d.order.orderNumber}</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.problem}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(d.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
