import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Gauge,
  Package,
  Truck,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { ViewKey } from "@/pages/Dashboard";
import { DecisionStatusBadge } from "./badges";
import { pct, timeAgo } from "./format";

const FLOW_COLORS: Record<string, string> = {
  Pending: "#0ea5e9",
  Picking: "#3b82f6",
  Packing: "#06b6d4",
  "Quality Check": "#8b5cf6",
  "Ready to Dispatch": "#10b981",
  Dispatched: "#34d399",
  Delayed: "#f59e0b",
  Exception: "#f43f5e",
  Completed: "#94a3b8",
};

export function Overview({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const dash = useQuery(api.queries.getDashboard);
  const analytics = useQuery(api.queries.getAnalytics);
  const decisions = useQuery(api.queries.getDecisions);

  if (!dash || !analytics) {
    return <Loading />;
  }

  const kpis = dash.kpis;
  const pendingDecisions = dash.pendingDecisions;
  const trend = [...analytics.metrics].sort((a, b) => a.day - b.day).slice(-14);

  const flow = Object.entries(dash.orderFlow).map(([status, count]) => ({ status, count }));

  return (
    <div className="space-y-5">
      {/* bottleneck alert */}
      {dash.bottlenecks.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <AlertTriangle className="size-4.5 text-amber-500" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                Bottleneck detected — {dash.bottlenecks[0].area} in Zone {dash.bottlenecks[0].zone}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Avg {dash.bottlenecks[0].avgTime} min vs {dash.bottlenecks[0].normal} min baseline (+
                {dash.bottlenecks[0].pctIncrease}%). {dash.bottlenecks[0].recommendation}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => onNavigate("decisions")} className="shrink-0">
            View AI resolution <ArrowRight className="ml-1.5 size-3.5" />
          </Button>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<Gauge className="size-4.5" />}
          iconClass="bg-violet-500/10 text-violet-500"
          label="Warehouse Efficiency"
          value={`${kpis.efficiencyScore}`}
          suffix="/ 100"
          sub={
            <span className="flex items-center gap-1 font-medium text-emerald-600">
              <TrendingUp className="size-3" /> weighted score
            </span>
          }
        />
        <KpiCard
          icon={<CheckCircle2 className="size-4.5" />}
          iconClass="bg-emerald-500/10 text-emerald-600"
          label="Fulfillment Rate"
          value={pct(kpis.fulfillmentRate)}
          sub={<span className="text-muted-foreground">{kpis.dispatchedToday} dispatched today</span>}
        />
        <KpiCard
          icon={<Package className="size-4.5" />}
          iconClass="bg-sky-500/10 text-sky-600"
          label="Orders In Flight"
          value={`${kpis.pendingOrders}`}
          sub={
            <span className="text-muted-foreground">
              {kpis.readyToDispatch} ready to dispatch
            </span>
          }
        />
        <KpiCard
          icon={<Boxes className="size-4.5" />}
          iconClass={kpis.criticalStock > 0 ? "bg-rose-500/10 text-rose-500" : "bg-sky-500/10 text-sky-600"}
          label="Low Stock SKUs"
          value={`${kpis.lowStockItems}`}
          sub={
            kpis.criticalStock > 0 ? (
              <span className="font-medium text-rose-500">{kpis.criticalStock} critical</span>
            ) : (
              <span className="text-muted-foreground">all healthy</span>
            )
          }
        />
      </div>

      {/* charts row */}
      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Fulfillment trend — last 14 days</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="fulfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => (d === 0 ? "Today" : `-${d}d`)}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  labelFormatter={(d) => (d === 0 ? "Today" : `${d} days ago`)}
                  formatter={(v: number | string) => [v, "orders"]}
                />
                <Area
                  type="monotone"
                  dataKey="fulfilled"
                  name="Fulfilled"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#fulfill)"
                />
                <Area
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Order flow by stage</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flow} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="status"
                  width={96}
                  tick={{ fontSize: 10.5, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                  formatter={(v: number | string) => [v, "orders"]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                  {flow.map((f) => (
                    <Cell key={f.status} fill={FLOW_COLORS[f.status] ?? "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* decisions + low stock + activity */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* pending decisions */}
        <Card className="xl:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BrainCircuit className="size-4 text-violet-500" /> AI Decisions
            </CardTitle>
            {pendingDecisions.length > 0 && (
              <Badge variant="outline" className="border-violet-500/25 bg-violet-500/10 text-violet-600">
                {pendingDecisions.length} pending
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-2.5">
            {pendingDecisions.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No pending decisions — all clear.
              </p>
            ) : (
              pendingDecisions.slice(0, 3).map((d) => (
                <div key={d._id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-violet-600">{d.decisionId}</span>
                    <DecisionStatusBadge status={d.status} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug">{d.problem}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{d.recommendation}</p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{timeAgo(d.createdAt)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-[11px]"
                      onClick={() => onNavigate("decisions")}
                    >
                      Review <ArrowRight className="size-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            <Button
              variant="ghost"
              className="w-full gap-1 text-xs font-medium text-violet-600 hover:text-violet-700"
              onClick={() => onNavigate("decisions")}
            >
              Open Decision Engine <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* low stock */}
        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Boxes className="size-4 text-amber-500" /> Stock at risk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dash.lowStock.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Inventory healthy.</p>
            ) : (
              dash.lowStock.map((p) => {
                const coverage = Math.max(0, p.available) / Math.max(1, p.avgDailyDemand);
                const pctAvail = Math.min(100, (p.available / Math.max(1, p.reorderLevel)) * 100);
                return (
                  <div key={p._id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium">{p.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {p.available} units · {coverage.toFixed(1)}d cover
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
                        <div
                          className={
                            p.available <= 0
                              ? "h-full rounded-full bg-rose-500"
                              : p.available <= p.reorderLevel / 2
                                ? "h-full rounded-full bg-amber-500"
                                : "h-full rounded-full bg-sky-500"
                          }
                          style={{ width: `${pctAvail}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {p.sku} · reorder at {p.reorderLevel} {p.incoming > 0 ? `· ${p.incoming} inbound` : ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <Button
              variant="ghost"
              className="w-full gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
              onClick={() => onNavigate("inventory")}
            >
              Manage inventory <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* activity feed */}
        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="size-4 text-sky-500" /> Activity feed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {dash.activity.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              dash.activity.map((a, i) => (
                <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < dash.activity.length - 1 && (
                    <span className="absolute left-[5px] top-4 h-full w-px bg-border" />
                  )}
                  <span
                    className={
                      "relative mt-1 size-[11px] shrink-0 rounded-full border-2 border-background " +
                      (a.type === "success"
                        ? "bg-emerald-500"
                        : a.type === "warning"
                          ? "bg-amber-500"
                          : a.type === "error"
                            ? "bg-rose-500"
                            : "bg-sky-500")
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-[12.5px] leading-snug">{a.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(a.at)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* quick actions strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <span className="mr-1 flex items-center gap-2 text-sm font-semibold">
          <Zap className="size-4 text-amber-500" /> Quick actions
        </span>
        <Button size="sm" variant="outline" onClick={() => onNavigate("decisions")}>
          Run AI allocation
        </Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate("orders")}>
          Review orders
        </Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate("exceptions")}>
          Exception queue ({dash.openExceptions})
        </Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate("operations")}>
          <Truck className="mr-1.5 size-3.5" /> Dispatch desk
        </Button>
      </div>

      {/* small print */}
      <p className="text-center text-[11px] text-muted-foreground">
        {decisions?.filter((d) => d.status === "Applied").length ?? 0} decisions applied ·{" "}
        {decisions?.filter((d) => d.status === "Overridden").length ?? 0} overridden · telemetry refreshes automatically
      </p>
    </div>
  );
}

function KpiCard({
  icon,
  iconClass,
  label,
  value,
  suffix,
  sub,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  suffix?: string;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-2.5">
          <div className={`flex size-9 items-center justify-center rounded-lg ${iconClass}`}>{icon}</div>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="mt-3 font-display text-2xl font-bold tracking-tight">
          {value}
          {suffix && <span className="ml-0.5 text-sm font-medium text-muted-foreground">{suffix}</span>}
        </div>
        <div className="mt-0.5 text-xs">{sub}</div>
      </CardContent>
    </Card>
  );
}

function Loading() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        <p className="text-xs text-muted-foreground">Syncing warehouse telemetry…</p>
      </div>
    </div>
  );
}
