import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  PackageOpen,
  Truck,
  XCircle,
} from "lucide-react";

/* Color semantics: blue = primary, green = success, amber = warning, red = critical, violet = AI */

const ORDER_STATUS_STYLES: Record<string, string> = {
  Pending: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  Picking: "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  Packing: "border-cyan-500/25 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  "Quality Check": "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  "Ready to Dispatch": "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  Dispatched: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Delayed: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  Exception: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  Completed: "border-slate-400/25 bg-slate-400/10 text-slate-600 dark:text-slate-300",
};

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const Icon =
    status === "Exception"
      ? AlertTriangle
      : status === "Delayed"
        ? Clock3
        : status === "Completed" || status === "Dispatched"
          ? CheckCircle2
          : status === "Ready to Dispatch"
            ? Truck
            : CircleDashed;
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", ORDER_STATUS_STYLES[status], className)}>
      <Icon className="size-3" />
      {status}
    </Badge>
  );
}

export function PriorityBadge({ level, className }: { level: string; className?: string }) {
  const styles: Record<string, string> = {
    Critical: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    High: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    Medium: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300",
    Low: "border-slate-400/25 bg-slate-400/10 text-slate-500 dark:text-slate-400",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", styles[level] ?? styles.Low, className)}>
      {level}
    </Badge>
  );
}

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const styles: Record<string, string> = {
    Critical: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    High: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    Medium: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300",
    Low: "border-slate-400/25 bg-slate-400/10 text-slate-500 dark:text-slate-400",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", styles[severity] ?? styles.Low, className)}>
      {severity}
    </Badge>
  );
}

const INV_STYLES: Record<string, string> = {
  Available: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  Partial: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  Shortage: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  Backordered: "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  Out: "border-rose-600/30 bg-rose-600/15 text-rose-700 dark:text-rose-300",
};

export function InventoryStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", INV_STYLES[status] ?? INV_STYLES.Available, className)}>
      {status === "Out" ? <XCircle className="size-3" /> : <PackageOpen className="size-3" />}
      {status}
    </Badge>
  );
}

export function DecisionStatusBadge({ status, className }: { status: string; className?: string }) {
  const styles: Record<string, string> = {
    Pending: "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300",
    Applied: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    Overridden: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    Ignored: "border-slate-400/25 bg-slate-400/10 text-slate-500 dark:text-slate-400",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", styles[status] ?? "", className)}>
      {status}
    </Badge>
  );
}
