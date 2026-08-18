import { useSeedOnMount } from "@/hooks/use-seed";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Boxes,
  BrainCircuit,
  CheckCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Route,
  Warehouse,
  X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { initials, timeAgo } from "@/components/command/format";
import { AnalyticsView } from "@/components/command/AnalyticsView";
import { DecisionsView } from "@/components/command/DecisionsView";
import { ExceptionsView } from "@/components/command/ExceptionsView";
import { InventoryView } from "@/components/command/InventoryView";
import { OperationsView } from "@/components/command/OperationsView";
import { OrdersView } from "@/components/command/OrdersView";
import { Overview } from "@/components/command/Overview";

export type ViewKey =
  | "overview"
  | "decisions"
  | "orders"
  | "inventory"
  | "operations"
  | "exceptions"
  | "analytics";

const VIEW_META: Record<ViewKey, { title: string; subtitle: string }> = {
  overview: { title: "Command Overview", subtitle: "Live pulse of warehouse operations" },
  decisions: { title: "AI Decision Engine", subtitle: "Exception → Decision → Resolution" },
  orders: { title: "Orders", subtitle: "Full order fulfillment lifecycle" },
  inventory: { title: "Inventory", subtitle: "Stock levels, availability & replenishment" },
  operations: { title: "Operations", subtitle: "Picking · Packing · QC · Dispatch" },
  exceptions: { title: "Exceptions", subtitle: "Operational problems & AI resolutions" },
  analytics: { title: "Analytics", subtitle: "Efficiency, zone load & workforce" },
};

function NavItem({
  icon: Icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-sky-400" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80")} />
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500/20 px-1.5 text-[10px] font-bold text-sky-300">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function Dashboard() {
  useSeedOnMount();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const decisions = useQuery(api.queries.getDecisions);
  const exceptions = useQuery(api.queries.getExceptions);

  const pendingCount = decisions?.filter((d) => d.status === "Pending").length ?? 0;
  const openExceptions = exceptions?.filter((e) => e.status === "Open").length ?? 0;

  const go = (v: ViewKey) => {
    setView(v);
    setSidebarOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const meta = VIEW_META[view];

  const navSections: { label: string; items: { key: ViewKey; icon: React.ElementType; label: string; badge?: number }[] }[] = [
    {
      label: "Command",
      items: [
        { key: "overview", icon: LayoutDashboard, label: "Overview" },
        { key: "decisions", icon: BrainCircuit, label: "AI Decisions", badge: pendingCount },
      ],
    },
    {
      label: "Operations",
      items: [
        { key: "orders", icon: ClipboardList, label: "Orders" },
        { key: "inventory", icon: Boxes, label: "Inventory" },
        { key: "operations", icon: Route, label: "Picking · Packing · QC" },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { key: "exceptions", icon: AlertTriangle, label: "Exceptions", badge: openExceptions },
        { key: "analytics", icon: BarChart3, label: "Analytics" },
      ],
    },
  ];

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
        <button type="button" onClick={() => go("overview")} className="flex items-center gap-2.5 outline-none">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/15">
            <Warehouse className="size-4.5 text-sky-400" />
          </div>
          <div className="text-left">
            <div className="font-display text-sm font-semibold leading-tight text-white">
              SmartFulfill <span className="text-sky-400">AI</span>
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
              Command Center
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent lg:hidden"
        >
          <X className="size-4" />
        </button>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-6">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/35">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    badge={item.badge}
                    active={view === item.key}
                    onClick={() => go(item.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-sidebar-accent"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-500 text-[11px] font-bold text-white">
                {user?.name ? initials(user.name) : "OP"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-sidebar-foreground">
                  {user?.name ?? "Warehouse Operator"}
                </div>
                <div className="truncate text-[11px] text-sidebar-foreground/45">Shift lead · Zone A–C</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52">
            <DropdownMenuLabel>{user?.email ?? user?.name ?? "Operator"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/")} className="cursor-pointer">
              <ArrowLeft className="mr-2 size-4" /> Back to site
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {/* mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-xl sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight">{meta.title}</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{meta.subtitle}</p>
          </div>

          <NotificationsBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-500 text-[11px] font-bold text-white">
                  {user?.name ? initials(user.name) : "OP"}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Warehouse Operator</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/")} className="cursor-pointer">
                <ArrowLeft className="mr-2 size-4" /> Back to site
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* content */}
        <main className="flex-1 px-4 py-6 sm:px-6">
          {view === "overview" && <Overview onNavigate={go} />}
          {view === "decisions" && <DecisionsView />}
          {view === "orders" && <OrdersView />}
          {view === "inventory" && <InventoryView />}
          {view === "operations" && <OperationsView />}
          {view === "exceptions" && <ExceptionsView />}
          {view === "analytics" && <AnalyticsView />}
        </main>
      </div>
    </div>
  );
}

/* ---------------- notifications bell ---------------- */

function NotificationsBell() {
  const notifications = useQuery(api.queries.getNotifications);
  const markAllRead = useMutation(api.ops.markAllNotificationsRead);

  const unread = notifications?.filter((n) => !n.read).length ?? 0;
  const list = notifications ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4.5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-[380px]">
          {list.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">No notifications yet</div>
          ) : (
            list.slice(0, 12).map((n) => (
              <div
                key={n._id}
                className={cn(
                  "flex items-start gap-3 border-b px-4 py-3 last:border-b-0",
                  !n.read && "bg-primary/[0.03]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 size-2 shrink-0 rounded-full",
                    n.severity === "critical" && "bg-rose-500",
                    n.severity === "warning" && "bg-amber-500",
                    n.severity === "success" && "bg-emerald-500",
                    n.severity === "info" && "bg-sky-500",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-foreground">{n.message}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.at)}</p>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
