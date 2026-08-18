import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardX,
  Flag,
  Package,
  Play,
  Route,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "./badges";
import { hoursLeft, inr, timeAgo } from "./format";

export function OperationsView() {
  const [tab, setTab] = useState("picking");

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-10 w-full justify-start overflow-x-auto rounded-xl bg-muted/60 sm:w-fit">
          <TabsTrigger value="picking" className="gap-1.5"><Route className="size-3.5" /> Picking</TabsTrigger>
          <TabsTrigger value="packing" className="gap-1.5"><Package className="size-3.5" /> Packing</TabsTrigger>
          <TabsTrigger value="qc" className="gap-1.5"><ShieldCheck className="size-3.5" /> Quality Check</TabsTrigger>
          <TabsTrigger value="dispatch" className="gap-1.5"><Truck className="size-3.5" /> Dispatch</TabsTrigger>
        </TabsList>

        <TabsContent value="picking" className="mt-4"><PickingTab /></TabsContent>
        <TabsContent value="packing" className="mt-4"><PackingTab /></TabsContent>
        <TabsContent value="qc" className="mt-4"><QcTab /></TabsContent>
        <TabsContent value="dispatch" className="mt-4"><DispatchTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- picking ---------------- */

function PickingTab() {
  const tasks = useQuery(api.queries.getPicking);
  const startPicking = useMutation(api.ops.startPicking);
  const completePicking = useMutation(api.ops.completePicking);
  const failPicking = useMutation(api.ops.failPicking);

  const [failOpen, setFailOpen] = useState<Id<"pickingTasks"> | null>(null);
  const [note, setNote] = useState("");

  const active = (tasks ?? []).filter((t) => t.status !== "Completed");

  if (!tasks) return <Loading />;

  const handleFail = async (taskId: Id<"pickingTasks">) => {
    try {
      await failPicking({ taskId, note });
      toast.error("Picking task failed — exception + AI decision created");
      setFailOpen(null);
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-3">
      {active.length === 0 && <Empty label="No picking tasks pending." />}
      {active.map((t) => (
        <TaskCard key={t._id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] font-bold">{t.taskId}</span>
                <Badge variant="outline" className={statusCls(t.status)}>{t.status}</Badge>
                {t.order && <OrderStatusBadge status={t.order.status} className="px-2 py-0 text-[10px]" />}
              </div>
              <p className="mt-1 text-[13px] font-medium">
                {t.order?.orderNumber ?? "—"} · {inr(t.order?.value ?? 0)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t.worker?.name ?? "Unassigned"} · {t.locations.length} locations · {t.originalDistance}m → {t.optimizedDistance}m route
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600">
              <Route className="mr-1 size-3" /> {t.savedPct}% distance saved
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {t.locations.map((loc) => (
              <span key={loc} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">{loc}</span>
            ))}
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary">Dock</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="mr-auto text-[11px] text-muted-foreground">
              {t.status === "In Progress" ? `Started ${timeAgo(t.startedAt ?? 0)}` : `Assigned ${timeAgo(t.assignedAt)}`}
            </span>
            {t.status === "Pending" && (
              <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void startPicking({ taskId: t._id })}>
                <Play className="size-3" /> Start picking
              </Button>
            )}
            {t.status === "In Progress" && (
              <>
                <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px] text-rose-600" onClick={() => setFailOpen(t._id)}>
                  <XCircle className="size-3" /> Fail
                </Button>
                <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void completePicking({ taskId: t._id })}>
                  <CheckCircle2 className="size-3" /> Complete → packing
                </Button>
              </>
            )}
          </div>
        </TaskCard>
      ))}

      <NoteDialog
        open={failOpen !== null}
        title="Fail picking task"
        description={failOpen ? `${failOpen}` : ""}
        note={note}
        setNote={setNote}
        confirmLabel="Fail task"
        destructive
        onConfirm={() => failOpen && void handleFail(failOpen)}
        onClose={() => setFailOpen(null)}
      />
    </div>
  );
}

/* ---------------- packing ---------------- */

function PackingTab() {
  const tasks = useQuery(api.queries.getPacking);
  const startPacking = useMutation(api.ops.startPacking);
  const completePacking = useMutation(api.ops.completePacking);
  const reportPackingIssue = useMutation(api.ops.reportPackingIssue);

  const [issueOpen, setIssueOpen] = useState<Id<"packingTasks"> | null>(null);
  const [note, setNote] = useState("");

  const active = (tasks ?? []).filter((t) => t.status !== "Completed");

  if (!tasks) return <Loading />;

  const handleIssue = async (taskId: Id<"packingTasks">) => {
    try {
      await reportPackingIssue({ taskId, description: note });
      toast.error("Packing issue reported — order moved to exception queue");
      setIssueOpen(null);
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-3">
      {active.length === 0 && <Empty label="No packing tasks pending." />}
      {active.map((t) => (
        <TaskCard key={t._id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] font-bold">{t.taskId}</span>
                <Badge variant="outline" className={statusCls(t.status)}>{t.status}</Badge>
                {t.order && <OrderStatusBadge status={t.order.status} className="px-2 py-0 text-[10px]" />}
              </div>
              <p className="mt-1 text-[13px] font-medium">
                {t.order?.orderNumber ?? "—"} · {t.order ? `${t.order.items.reduce((s, i) => s + i.qty, 0)} items` : ""}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t.station} · {t.worker?.name ?? "Unassigned"}
              </p>
            </div>
            <Package className="size-4.5 text-cyan-500" />
          </div>
          {t.status === "Failed" && t.note && (
            <p className="mt-2 rounded-lg bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              <Flag className="mr-1 inline size-3" /> {t.note}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="mr-auto text-[11px] text-muted-foreground">
              {t.status === "In Progress" ? `Started ${timeAgo(t.startedAt ?? 0)}` : t.status === "Failed" ? "Needs rework" : "Queued for packing"}
            </span>
            {t.status === "Pending" && (
              <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void startPacking({ taskId: t._id })}>
                <Play className="size-3" /> Start packing
              </Button>
            )}
            {t.status === "In Progress" && (
              <>
                <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px] text-amber-600" onClick={() => setIssueOpen(t._id)}>
                  <ClipboardX className="size-3" /> Report issue
                </Button>
                <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void completePacking({ taskId: t._id })}>
                  <CheckCircle2 className="size-3" /> Complete → QC
                </Button>
              </>
            )}
          </div>
        </TaskCard>
      ))}

      <NoteDialog
        open={issueOpen !== null}
        title="Report packing issue"
        description={issueOpen ? `${issueOpen}` : ""}
        note={note}
        setNote={setNote}
        confirmLabel="Report issue"
        destructive
        onConfirm={() => issueOpen && void handleIssue(issueOpen)}
        onClose={() => setIssueOpen(null)}
      />
    </div>
  );
}

/* ---------------- QC ---------------- */

function QcTab() {
  const tasks = useQuery(api.queries.getQc);
  const qcPass = useMutation(api.ops.qcPass);
  const qcFail = useMutation(api.ops.qcFail);

  const [failOpen, setFailOpen] = useState<Id<"qcTasks"> | null>(null);
  const [note, setNote] = useState("");

  const active = (tasks ?? []).filter((t) => t.status !== "Passed");

  if (!tasks) return <Loading />;

  const handleFail = async (taskId: Id<"qcTasks">) => {
    try {
      await qcFail({ taskId, note });
      toast.error("QC failed — item quarantined, AI decision created");
      setFailOpen(null);
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-3">
      {active.length === 0 && <Empty label="No QC tasks pending." />}
      {active.map((t) => (
        <TaskCard key={t._id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] font-bold">{t.taskId}</span>
                <Badge variant="outline" className={t.status === "Failed" ? "border-rose-500/25 bg-rose-500/10 text-rose-600" : "border-violet-500/25 bg-violet-500/10 text-violet-600"}>
                  {t.status}
                </Badge>
                {t.order && <OrderStatusBadge status={t.order.status} className="px-2 py-0 text-[10px]" />}
              </div>
              <p className="mt-1 text-[13px] font-medium">
                {t.order?.orderNumber ?? "—"} · {inr(t.order?.value ?? 0)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Inspector: {t.inspector?.name ?? "Unassigned"}
              </p>
            </div>
            <ShieldCheck className="size-4.5 text-violet-500" />
          </div>
          {t.status === "Failed" && t.note && (
            <p className="mt-2 rounded-lg bg-rose-500/[0.06] px-3 py-2 text-[11px] text-rose-600">
              <Flag className="mr-1 inline size-3" /> {t.note}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="mr-auto text-[11px] text-muted-foreground">
              {t.inspectedAt ? `Checked ${timeAgo(t.inspectedAt)}` : "Awaiting inspection"}
            </span>
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px] text-rose-600" onClick={() => setFailOpen(t._id)}>
              <XCircle className="size-3" /> Fail
            </Button>
            <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void qcPass({ taskId: t._id })}>
              <CheckCircle2 className="size-3" /> Pass → dispatch queue
            </Button>
          </div>
        </TaskCard>
      ))}

      <NoteDialog
        open={failOpen !== null}
        title="Fail quality check"
        description={failOpen ? `${failOpen}` : ""}
        note={note}
        setNote={setNote}
        confirmLabel="Fail check"
        destructive
        onConfirm={() => failOpen && void handleFail(failOpen)}
        onClose={() => setFailOpen(null)}
      />
    </div>
  );
}

/* ---------------- dispatch ---------------- */

function DispatchTab() {
  const records = useQuery(api.queries.getDispatch);
  const dispatchOrder = useMutation(api.ops.dispatchOrder);

  if (!records) return <Loading />;

  const ready = records.filter((r) => r.status === "Ready");
  const rest = records.filter((r) => r.status !== "Ready");

  return (
    <div className="space-y-4">
      {ready.length === 0 && <Empty label="No orders at the dispatch dock." />}
      {ready.map((r) => (
        <TaskCard key={r._id} accent>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] font-bold">{r.dispatchId}</span>
                <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600">Ready</Badge>
                <span className="font-mono text-[13px] font-semibold">{r.order?.orderNumber ?? ""}</span>
              </div>
              <p className="mt-1 text-[13px] font-medium">
                {r.destination} · {r.carrier} · {r.packageWeight}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Customer: {r.customer?.name ?? "—"} · Deadline {hoursLeft(r.deadline)}
              </p>
            </div>
            <Button size="sm" className="h-8 gap-1.5" onClick={() => void dispatchOrder({ orderId: r.orderId })}>
              <Truck className="size-3.5" /> Dispatch now
            </Button>
          </div>
        </TaskCard>
      ))}

      {rest.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Carrier log ({rest.length})
          </h2>
          <Card className="overflow-hidden shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">Dispatch</th>
                    <th className="px-4 py-2.5">Order</th>
                    <th className="px-4 py-2.5">Carrier</th>
                    <th className="px-4 py-2.5">Destination</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rest.slice(0, 12).map((r) => (
                    <tr key={r._id}>
                      <td className="px-4 py-2.5 font-mono text-[12px] font-semibold">{r.dispatchId}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px]">{r.order?.orderNumber ?? "—"}</td>
                      <td className="px-4 py-2.5">{r.carrier}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.destination}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={r.status === "Delayed" ? "border-amber-500/25 bg-amber-500/10 text-amber-600" : "border-slate-400/25 bg-slate-400/10 text-slate-500"}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[11px] text-muted-foreground">
                        {r.dispatchedAt ? timeAgo(r.dispatchedAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function NoteDialog({
  open,
  title,
  description,
  note,
  setNote,
  confirmLabel,
  destructive,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  note: string;
  setNote: (v: string) => void;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe what happened…" rows={3} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={destructive ? "destructive" : "default"} disabled={!note.trim()} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return <Card className={cn("p-4 shadow-none", accent && "border-emerald-500/30 bg-emerald-500/[0.03]")}>{children}</Card>;
}

function statusCls(status: string) {
  return cn(
    "px-2 py-0 text-[10px]",
    status === "In Progress"
      ? "border-sky-500/25 bg-sky-500/10 text-sky-600"
      : status === "Failed"
        ? "border-rose-500/25 bg-rose-500/10 text-rose-600"
        : status === "Completed"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600"
          : "border-slate-400/25 bg-slate-400/10 text-slate-500",
  );
}

function Empty({ label }: { label: string }) {
  return (
    <Card className="shadow-none">
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <CheckCircle2 className="size-6 text-emerald-500" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function Loading() {
  return <div className="flex h-[40vh] items-center justify-center text-xs text-muted-foreground">Loading operations…</div>;
}
