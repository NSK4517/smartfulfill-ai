import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Gauge, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnalyticsView() {
  const analytics = useQuery(api.queries.getAnalytics);
  const dash = useQuery(api.queries.getDashboard);

  if (!analytics || !dash) {
    return <div className="flex h-[50vh] items-center justify-center text-xs text-muted-foreground">Loading analytics…</div>;
  }

  const trend = [...analytics.metrics].sort((a, b) => a.day - b.day).slice(-14);
  const zoneData = trend.map((m) => ({ day: m.day, A: m.zoneA, B: m.zoneB, C: m.zoneC }));
  const efficiency = dash.efficiency;

  const workers = analytics.workers;
  const activeWorkers = workers.filter((w) => w.active).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* efficiency score */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Gauge className="size-4 text-violet-500" /> Warehouse efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div
                className="relative flex size-24 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#8b5cf6 ${efficiency.score * 3.6}deg, var(--muted) 0deg)`,
                }}
              >
                <div className="flex size-[76px] items-center justify-center rounded-full bg-card">
                  <div className="text-center">
                    <div className="font-display text-2xl font-bold leading-none">{efficiency.score}</div>
                    <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">/ 100</div>
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {efficiency.breakdown.map((b) => (
                  <div key={b.label} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-[11px] text-muted-foreground">{b.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          b.value >= 80 ? "bg-emerald-500" : b.value >= 60 ? "bg-amber-500" : "bg-rose-500",
                        )}
                        style={{ width: `${b.value}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[11px] font-semibold">{b.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* worker productivity */}
        <Card className="shadow-none lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-sky-500" /> Workforce ({activeWorkers} active)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">Worker</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Zone</th>
                    <th className="px-4 py-2.5 text-right">Tasks</th>
                    <th className="px-4 py-2.5 text-right">Avg pick (min)</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {workers.map((w) => (
                    <tr key={w._id}>
                      <td className="px-4 py-2.5 text-[13px] font-medium">{w.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{w.role}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">{w.zone}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">{w.tasksCompleted}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{w.avgPickTimeMin.toFixed(1)}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-2 py-0 text-[10px]",
                            w.active ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600" : "border-slate-400/25 bg-slate-400/10 text-slate-500",
                          )}
                        >
                          {w.active ? "On shift" : "Off"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* cycle time trend */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="size-4 text-amber-500" /> Cycle time trend — last 14 days
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                labelFormatter={(d) => (d === 0 ? "Today" : `${d} days ago`)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="pickTimeMin" name="Picking (min)" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="packTimeMin" name="Packing (min)" stroke="#06b6d4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="dispatchOnTimePct" name="On-time dispatch %" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* zone load */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Zone utilization (%) — last 14 days</CardTitle>
        </CardHeader>
        <CardContent className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={zoneData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={(d) => (d === 0 ? "Today" : `-${d}d`)}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                labelFormatter={(d) => (d === 0 ? "Today" : `${d} days ago`)}
                formatter={(v: number | string) => [`${v}%`]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="A" name="Zone A" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="B" name="Zone B" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="C" name="Zone C" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
