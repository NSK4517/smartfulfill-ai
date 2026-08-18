import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Command,
  Cpu,
  Crosshair,
  Gauge,
  Headset,
  Layers,
  MapPin,
  PackageCheck,
  Radar,
  RefreshCcw,
  Route,
  ScanBarcode,
  ShieldCheck,
  Sparkles,
  Target,
  Truck,
  Warehouse,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router";
import logo from "@/assets/logo.svg";

const LIFECYCLE = [
  { icon: Command, label: "Order Created" },
  { icon: Target, label: "Priority Set" },
  { icon: ScanBarcode, label: "Stock Checked" },
  { icon: BrainCircuit, label: "Smart Allocation" },
  { icon: Route, label: "Picking" },
  { icon: Boxes, label: "Packing" },
  { icon: ShieldCheck, label: "Quality Check" },
  { icon: Truck, label: "Dispatch" },
  { icon: CheckCircle2, label: "Completed" },
];

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "AI Decision Engine",
    desc: "Every exception becomes a decision: problem, analysis, recommendation and expected impact — with one-click apply or operator override.",
    accent: "text-violet-300",
    ring: "group-hover:ring-violet-400/30",
    chip: "bg-violet-400/10 text-violet-300",
  },
  {
    icon: Zap,
    title: "Priority-Based Allocation",
    desc: "Scarce stock is fought over by competing orders — the engine ranks them by customer tier, deadline, value and risk, then allocates fairly.",
    accent: "text-sky-300",
    ring: "group-hover:ring-sky-400/30",
    chip: "bg-sky-400/10 text-sky-300",
  },
  {
    icon: Route,
    title: "Route Optimization",
    desc: "Picking routes are re-sequenced with nearest-neighbour optimization, cutting walking distance by up to 38% per wave.",
    accent: "text-emerald-300",
    ring: "group-hover:ring-emerald-400/30",
    chip: "bg-emerald-400/10 text-emerald-300",
  },
  {
    icon: RefreshCcw,
    title: "Replenishment Intelligence",
    desc: "Lead time, daily demand and safety stock are combined into reorder points, so stockouts are prevented before they happen.",
    accent: "text-amber-300",
    ring: "group-hover:ring-amber-400/30",
    chip: "bg-amber-400/10 text-amber-300",
  },
  {
    icon: Gauge,
    title: "Bottleneck Detection",
    desc: "Zone-level cycle times are tracked against baselines — the system flags slowdowns and recommends worker redeployment.",
    accent: "text-cyan-300",
    ring: "group-hover:ring-cyan-400/30",
    chip: "bg-cyan-400/10 text-cyan-300",
  },
  {
    icon: ClipboardCheck,
    title: "QC & Dispatch Control",
    desc: "Quality checks, carrier allocation and on-time dispatch SLAs are managed end-to-end with full order timelines.",
    accent: "text-rose-300",
    ring: "group-hover:ring-rose-400/30",
    chip: "bg-rose-400/10 text-rose-300",
  },
];

const STATS = [
  { value: "9", label: "Fulfillment stages under control" },
  { value: "38%", label: "Avg. pick route distance saved" },
  { value: "100%", label: "Deterministic, explainable decisions" },
  { value: "< 1s", label: "Decision-engine evaluation time" },
];

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.55, delay, ease: "easeOut" as const },
  };
}

export default function Landing() {
  const navigate = useNavigate();
  const go = (path: string) => () => navigate(path);

  return (
    <div className="min-h-screen bg-[#050a16] text-slate-200 antialiased selection:bg-sky-400/30">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(56,132,255,0.16),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute right-[-160px] top-1/3 h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-[120px]" />
      </div>

      {/* ---------- nav ---------- */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050a16]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <button
            type="button"
            onClick={go("/")}
            className="flex items-center gap-2.5 outline-none"
          >
            <img src={logo} alt="SmartFulfill AI logo" width={30} height={30} className="rounded-md" />
            <span className="font-display text-[15px] font-semibold tracking-tight text-white">
              SmartFulfill <span className="text-sky-400">AI</span>
            </span>
          </button>

          <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a href="#engine" className="transition-colors hover:text-slate-100">AI Engine</a>
            <a href="#lifecycle" className="transition-colors hover:text-slate-100">Lifecycle</a>
            <a href="#features" className="transition-colors hover:text-slate-100">Capabilities</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={go("/auth")}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={go("/auth?returnTo=%2Fdashboard")}
              className="group flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_24px_rgba(56,132,255,0.35)] transition-all hover:bg-sky-400 hover:shadow-[0_0_32px_rgba(56,132,255,0.5)]"
            >
              Launch Command Center
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="relative mx-auto w-full max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-sky-300"
            >
              <Radar className="size-3.5" />
              MISSION CONTROL FOR WAREHOUSE OPERATIONS
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl"
            >
              Every exception,
              <br />
              decided{" "}
              <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
                in seconds.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg"
            >
              SmartFulfill AI is an AI-powered warehouse command center that runs the
              complete order fulfillment lifecycle — and when something goes wrong, it
              doesn&apos;t just alert you. It analyzes the situation, recommends the best
              action, and lets you apply or override it in one click.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <button
                type="button"
                onClick={go("/auth?returnTo=%2Fdashboard")}
                className="group flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_32px_rgba(56,132,255,0.4)] transition-all hover:bg-sky-400 hover:shadow-[0_0_44px_rgba(56,132,255,0.55)]"
              >
                <BrainCircuit className="size-4.5" />
                Open the Command Center
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={go("/auth?returnTo=%2Fdashboard")}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
              >
                <Layers className="size-4.5 text-slate-400" />
                Explore the workflow
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-12 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-white/5 pt-8 sm:grid-cols-4"
            >
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-2xl font-bold text-white">{s.value}</div>
                  <div className="mt-1 text-xs leading-4 text-slate-500">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ---------- live decision card ---------- */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-sky-500/10 via-transparent to-violet-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a1122]/90 shadow-2xl shadow-black/50 backdrop-blur">
              {/* window bar */}
              <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    AI Decision Engine · Live
                  </span>
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                  <Activity className="size-3" /> OPERATIONAL
                </span>
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-300">
                        <Crosshair className="size-3" /> Inventory Conflict
                      </span>
                      <span className="rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                        Critical
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold text-white">
                      Wireless Headphones · Required 10 · Available 7
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Order <span className="text-slate-300">#1042</span> · Aarti Mehta · Deadline in 2h 30m
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="flex items-start gap-2.5 rounded-lg border border-sky-400/15 bg-sky-400/[0.06] p-3">
                    <BrainCircuit className="mt-0.5 size-4 shrink-0 text-sky-300" />
                    <p className="text-[13px] leading-relaxed text-slate-300">
                      <span className="font-semibold text-sky-300">AI Recommendation:</span>{" "}
                      Allocate all 7 available units to <span className="text-white">#1042</span> (Critical
                      priority, earliest deadline), hold <span className="text-white">#1048</span>, backorder 3
                      units and raise a replenishment request.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Critical order fulfilled", "text-emerald-300"],
                      ["#1048 delayed", "text-amber-300"],
                      ["Stockout prevented", "text-sky-300"],
                      ["Reorder created", "text-violet-300"],
                    ].map(([label, color]) => (
                      <div
                        key={label}
                        className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                      >
                        <CheckCircle2 className={`size-3.5 shrink-0 ${color}`} />
                        <span className="text-[11px] leading-tight text-slate-400">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex gap-2.5">
                  <button
                    type="button"
                    onClick={go("/auth?returnTo=%2Fdashboard")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-sky-400"
                  >
                    <Zap className="size-3.5" /> Apply Recommendation
                  </button>
                  <button
                    type="button"
                    onClick={go("/auth?returnTo=%2Fdashboard")}
                    className="flex-1 rounded-lg border border-white/10 py-2.5 text-[13px] font-semibold text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5"
                  >
                    Override
                  </button>
                </div>
              </div>

              <div className="border-t border-white/5 bg-white/[0.02] px-5 py-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="size-3.5" /> Detected 38 min ago · decision pending
                  </span>
                  <span className="flex items-center gap-1.5 text-violet-300">
                    <Sparkles className="size-3.5" /> explainable · deterministic
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------- exception → decision → resolution ---------- */}
      <section id="engine" className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <motion.div {...fadeUp(0)} className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-violet-300">
            <BrainCircuit className="size-3.5" /> THE CORE LOOP
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Exception <span className="text-slate-500">→</span> Decision{" "}
            <span className="text-slate-500">→</span> Resolution
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            SmartFulfill doesn&apos;t just surface problems. A rule-based intelligence layer —
            modular enough for an LLM to plug in later — turns every operational problem into
            an explained, actionable decision the warehouse manager can approve or override.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            {
              step: "01",
              icon: Crosshair,
              title: "Detect",
              desc: "Stockouts, allocation conflicts, damaged items, QC failures, bottlenecks and dispatch delays are detected in real time as orders flow through the pipeline.",
              color: "text-rose-300",
              chip: "bg-rose-400/10",
            },
            {
              step: "02",
              icon: BrainCircuit,
              title: "Analyze",
              desc: "The engine weighs priority scores, deadlines, customer tiers, available stock, lead times and zone workloads — then explains the reasoning in plain language.",
              color: "text-violet-300",
              chip: "bg-violet-400/10",
            },
            {
              step: "03",
              icon: Zap,
              title: "Resolve",
              desc: "Every recommendation ships with expected impact. Apply it, override it, or ignore it — the action, operator choice and outcome are logged for full auditability.",
              color: "text-emerald-300",
              chip: "bg-emerald-400/10",
            },
          ].map((card, i) => (
            <motion.div
              key={card.step}
              {...fadeUp(0.1 * i)}
              className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-6 transition-colors hover:border-white/15"
            >
              <span className="absolute right-5 top-5 font-display text-4xl font-bold text-white/[0.05]">
                {card.step}
              </span>
              <div className={`flex size-11 items-center justify-center rounded-xl ${card.chip}`}>
                <card.icon className={`size-5 ${card.color}`} />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-white">{card.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- lifecycle ---------- */}
      <section id="lifecycle" className="relative border-y border-white/5 bg-[#071023]/60">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
          <motion.div {...fadeUp(0)} className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-sky-300">
              <Warehouse className="size-3.5" /> END-TO-END ORCHESTRATION
            </span>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              One order. Nine stages. Zero guesswork.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Every order moves through the full fulfillment lifecycle, with live timelines,
              priority scoring at intake and an AI allocation pass before anything touches a shelf.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-3 sm:grid-cols-3 lg:grid-cols-9">
            {LIFECYCLE.map((stage, i) => (
              <motion.div
                key={stage.label}
                {...fadeUp(0.05 * i)}
                className="group relative flex flex-col items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-2 py-5 text-center transition-colors hover:border-sky-400/30 hover:bg-sky-400/[0.05]"
              >
                <div className="relative">
                  <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-[#0c1530] text-slate-400 transition-colors group-hover:border-sky-400/40 group-hover:text-sky-300">
                    <stage.icon className="size-4.5" />
                  </div>
                  <span className="absolute -right-2.5 -top-1 flex size-4 items-center justify-center rounded-full bg-[#0c1530] text-[9px] font-bold text-slate-500">
                    {i + 1}
                  </span>
                </div>
                <span className="text-[11px] font-medium leading-tight text-slate-400 group-hover:text-slate-200">
                  {stage.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- features ---------- */}
      <section id="features" className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <motion.div {...fadeUp(0)} className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-cyan-300">
            <Cpu className="size-3.5" /> CAPABILITIES
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            A warehouse brain, not a database skin
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Every capability is backed by a deterministic engine with a full audit trail — and
            the architecture is ready to swap rules for an LLM layer later.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              {...fadeUp(0.07 * i)}
              className={`group rounded-2xl border border-white/8 bg-white/[0.03] p-6 ring-1 ring-transparent transition-all hover:bg-white/[0.05] ${f.ring}`}
            >
              <div className={`flex size-11 items-center justify-center rounded-xl ${f.chip}`}>
                <f.icon className={`size-5 ${f.accent}`} />
              </div>
              <h3 className="mt-5 font-display text-base font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="relative mx-auto w-full max-w-7xl px-5 pb-24 sm:px-8">
        <motion.div
          {...fadeUp(0)}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1730] via-[#0a1122] to-[#141030] px-6 py-16 text-center sm:px-12"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(56,132,255,0.18),transparent)]" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" />
          <div className="relative">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-sky-400/25 bg-sky-400/10">
              <Headset className="size-6 text-sky-300" />
            </div>
            <h2 className="mx-auto mt-6 max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Step into the command center
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-400">
              Watch the decision engine resolve live inventory conflicts, run demo scenarios,
              and drive orders from intake to dispatch. No setup, no external APIs — just a
              fully seeded warehouse.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={go("/auth?returnTo=%2Fdashboard")}
                className="group flex items-center gap-2 rounded-xl bg-sky-500 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_0_32px_rgba(56,132,255,0.4)] transition-all hover:bg-sky-400 hover:shadow-[0_0_44px_rgba(56,132,255,0.55)]"
              >
                Launch Command Center
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={go("/auth")}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-7 py-3.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
              >
                <MapPin className="size-4.5 text-slate-400" />
                Sign in
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ---------- footer ---------- */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="SmartFulfill AI logo" width={22} height={22} className="rounded" />
            <span className="text-sm font-medium text-slate-300">
              SmartFulfill <span className="text-sky-400">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <PackageCheck className="size-3.5" /> Demo dataset · 50+ SKUs · 50 orders
            </span>
            <span className="flex items-center gap-1.5">
              <ScanBarcode className="size-3.5" /> Built for hackathon-grade realism
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
