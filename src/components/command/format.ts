/** Formatting + display helpers for the SmartFulfill command center. */

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function hoursLeft(deadline: number): string {
  const diff = deadline - Date.now();
  if (diff <= 0) return "overdue";
  const h = diff / HOUR;
  if (h < 1) return `${Math.max(1, Math.floor(diff / MIN))}m left`;
  if (h < 24) return `${Math.round(h * 10) / 10}h left`;
  return `${Math.round(h / 24)}d left`;
}

export function deadlineTone(deadline: number): "critical" | "warning" | "ok" {
  const diff = deadline - Date.now();
  if (diff <= 0 || diff < 3 * HOUR) return "critical";
  if (diff < 8 * HOUR) return "warning";
  return "ok";
}

export function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export const ORDER_STATUS_ORDER = [
  "Exception",
  "Delayed",
  "Pending",
  "Picking",
  "Packing",
  "Quality Check",
  "Ready to Dispatch",
  "Dispatched",
  "Completed",
] as const;

export function statusRank(s: string): number {
  const idx = ORDER_STATUS_ORDER.indexOf(s as (typeof ORDER_STATUS_ORDER)[number]);
  return idx === -1 ? 99 : idx;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
