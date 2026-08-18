/**
 * SmartFulfill AI — Decision Engine
 * ---------------------------------------------------------------
 * Pure, deterministic rule-based intelligence. Every function is
 * independent and side-effect free, so a real ML/LLM layer can be
 * dropped in later without touching the rest of the system.
 */

export const TIER_POINTS: Record<string, number> = {
  Platinum: 30,
  Premium: 24,
  Standard: 18,
  Basic: 12,
};

export interface PriorityReason {
  label: string;
  points: number;
}

export interface PriorityResult {
  score: number;
  level: "Critical" | "High" | "Medium" | "Low";
  reasons: PriorityReason[];
}

/** Explainable priority score, normalized to 0–100. */
export function calculateOrderPriority(input: {
  customerTier: string;
  deadline: number;
  createdAt: number;
  value: number;
  inventoryStatus: string;
  now: number;
}): PriorityResult {
  const { customerTier, deadline, createdAt, value, inventoryStatus, now } = input;
  const reasons: PriorityReason[] = [];

  // 1. Customer priority (0–30)
  const cust = TIER_POINTS[customerTier] ?? 12;
  reasons.push({ label: `${customerTier} customer`, points: cust });

  // 2. Delivery urgency (0–25)
  const hoursLeft = (deadline - now) / 3_600_000;
  let urgency = 2;
  if (hoursLeft <= 0) urgency = 25;
  else if (hoursLeft <= 2) urgency = 25;
  else if (hoursLeft <= 6) urgency = 18;
  else if (hoursLeft <= 12) urgency = 10;
  else if (hoursLeft <= 24) urgency = 6;
  reasons.push({
    label: hoursLeft <= 0 ? "Deadline passed" : `Deadline in ${hoursLeft < 1 ? "<1" : Math.round(hoursLeft)}h`,
    points: urgency,
  });

  // 3. Order age (0–15) — waiting time pressure
  const minutes = Math.max(0, (now - createdAt) / 60_000);
  const age = Math.min(15, Math.floor(minutes / 6) * 3);
  if (age > 0) reasons.push({ label: `Order waiting for ${Math.floor(minutes)} min`, points: age });

  // 4. Order value (0–15)
  const valuePts = Math.min(15, Math.floor(value / 700));
  if (valuePts > 0) reasons.push({ label: `High-value order (₹${value.toLocaleString("en-IN")})`, points: valuePts });

  // 5. Inventory conflict / availability (0–10)
  let invPts = 0;
  if (inventoryStatus === "Shortage" || inventoryStatus === "Out") invPts = 10;
  else if (inventoryStatus === "Backordered") invPts = 8;
  else if (inventoryStatus === "Partial") invPts = 6;
  if (invPts > 0) reasons.push({ label: "Inventory conflict", points: invPts });

  const score = Math.min(100, reasons.reduce((s, r) => s + r.points, 0));
  const level = score >= 80 ? "Critical" : score >= 60 ? "High" : score >= 40 ? "Medium" : "Low";
  return { score, level, reasons };
}

/* ------------------------------------------------------------------ */
/* Smart inventory allocation                                         */
/* ------------------------------------------------------------------ */

export interface AllocOrderItem {
  productId: string;
  qty: number;
  allocated: number;
}

export interface AllocOrder {
  orderId: string;
  orderNumber: string;
  priorityScore: number;
  priorityLevel: string;
  items: AllocOrderItem[];
}

export interface AllocResult {
  /** per order per product: newly allocated units */
  allocations: { orderId: string; orderNumber: string; productId: string; sku: string; allocated: number }[];
  /** backordered demand */
  backorders: { orderId: string; orderNumber: string; productId: string; sku: string; qty: number }[];
  /** held orders (received 0 units while competing demand exists) */
  holds: string[];
  unfulfilled: number;
  explanation: string[];
  productShortages: { productId: string; sku: string; short: number }[];
}

/**
 * Rank competing orders by priority and allocate scarce stock.
 * Never allocates below zero — stock can not go negative.
 */
export function allocateInventory(input: {
  orders: AllocOrder[];
  stock: Record<string, number>; // productId -> currently available
  names: Record<string, string>; // productId -> sku
  now: number;
}): AllocResult {
  const { orders, stock, names } = input;
  const pool: Record<string, number> = { ...stock };
  const allocations: AllocResult["allocations"] = [];
  const backorders: AllocResult["backorders"] = [];
  const holds: string[] = [];
  const productShortages: Record<string, number> = {};
  let unfulfilled = 0;

  const byPriority = [...orders].sort((a, b) => b.priorityScore - a.priorityScore);
  // Track per-order allocation totals to decide holds
  const orderGot: Record<string, boolean> = {};
  const orderDemand: Record<string, number> = {};

  for (const order of byPriority) {
    let gotAny = false;
    for (const item of order.items) {
      const need = item.qty - item.allocated;
      if (need <= 0) {
        if (item.allocated > 0) gotAny = true;
        continue;
      }
      orderDemand[order.orderId] = (orderDemand[order.orderId] ?? 0) + need;
      const avail = pool[item.productId] ?? 0;
      const give = Math.min(need, avail);
      if (give > 0) {
        pool[item.productId] = avail - give;
        gotAny = true;
        allocations.push({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          productId: item.productId,
          sku: names[item.productId] ?? item.productId,
          allocated: give,
        });
      }
      if (give < need) {
        const short = need - give;
        unfulfilled += short;
        productShortages[item.productId] = (productShortages[item.productId] ?? 0) + short;
        backorders.push({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          productId: item.productId,
          sku: names[item.productId] ?? item.productId,
          qty: short,
        });
      }
    }
    if (!gotAny) holds.push(`${order.orderNumber} (${order.priorityLevel} priority)`);
    if (gotAny) orderGot[order.orderId] = true;
  }

  const explanation: string[] = [];
  for (const a of allocations) {
    const order = orders.find((o) => o.orderId === a.orderId)!;
    explanation.push(
      `Allocated ${a.allocated} of ${order.items.find((i) => i.productId === a.productId)?.qty ?? "?"} units of ${a.sku} to ${a.orderNumber} (${order.priorityLevel} priority).`,
    );
  }
  for (const h of holds) {
    explanation.push(`Held ${h} — stock exhausted by higher-priority demand.`);
  }
  for (const b of backorders) {
    explanation.push(`Backordered ${b.qty} units of ${b.sku} for ${b.orderNumber}.`);
  }
  if (unfulfilled > 0) {
    explanation.push(`${unfulfilled} units of demand remain unfulfilled — replenishment required.`);
  } else {
    explanation.push("All demand fulfilled — no stock conflicts detected.");
  }

  return {
    allocations,
    backorders,
    holds,
    unfulfilled,
    explanation,
    productShortages: Object.entries(productShortages).map(([productId, short]) => ({
      productId,
      sku: names[productId] ?? productId,
      short,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Reorder recommendations                                            */
/* ------------------------------------------------------------------ */

export function computeReorderPoint(input: {
  avgDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
}): number {
  return Math.ceil(input.avgDailyDemand * input.leadTimeDays + input.safetyStock);
}

export function reorderRecommendation(input: {
  avgDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
  available: number;
  incoming: number;
  coverageDays?: number;
}): { reorderPoint: number; recommended: number; stockoutInDays: number; reason: string } | null {
  const reorderPoint = computeReorderPoint(input);
  const coverage = input.coverageDays ?? 7;
  const target = input.avgDailyDemand * (input.leadTimeDays + coverage);
  const recommended = Math.max(0, Math.ceil((target - input.available - input.incoming) / 10) * 10);
  const stockoutInDays = input.available <= 0 ? 0 : Math.floor(input.available / Math.max(1, input.avgDailyDemand));

  if (input.available > reorderPoint) return null;

  const reason =
    input.available <= 0
      ? `SKU is out of stock. Lead time is ${input.leadTimeDays} days with average demand of ${input.avgDailyDemand}/day.`
      : `Stock (${input.available}) is at/below reorder point (${reorderPoint}) and may reach stockout within ${stockoutInDays} day${stockoutInDays === 1 ? "" : "s"} at current demand.`;

  return { reorderPoint, recommended, stockoutInDays, reason };
}

/* ------------------------------------------------------------------ */
/* Picking route optimization (nearest-neighbour over grid)           */
/* ------------------------------------------------------------------ */

const CELL_METERS = 6;

export function locToCoords(loc: string): [number, number] {
  const letter = loc.charAt(0).toUpperCase();
  const row = letter.charCodeAt(0) - 65;
  const col = parseInt(loc.slice(1), 10) - 1;
  return [isNaN(row) ? 0 : row, isNaN(col) ? 0 : col];
}

export function distanceBetween(a: string, b: string): number {
  const [r1, c1] = locToCoords(a);
  const [r2, c2] = locToCoords(b);
  return (Math.abs(r1 - r2) + Math.abs(c1 - c2)) * CELL_METERS;
}

export function routeDistance(route: string[]): number {
  let d = 0;
  let prev = "START";
  for (const loc of route) {
    d += distanceBetween(prev, loc);
    prev = loc;
  }
  return d;
}

/** Nearest-neighbour optimization starting from the dock. */
export function optimizePickingRoute(locations: string[]): {
  originalRoute: string[];
  optimizedRoute: string[];
  originalDistance: number;
  optimizedDistance: number;
  savedPct: number;
} {
  const originalRoute = [...locations];
  const originalDistance = routeDistance(originalRoute);

  const remaining = [...locations];
  const optimizedRoute: string[] = [];
  let current = "START";
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distanceBetween(current, remaining[i]);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    optimizedRoute.push(next);
    current = next;
  }

  const optimizedDistance = routeDistance(optimizedRoute);
  const savedPct = originalDistance > 0
    ? Math.round(((originalDistance - optimizedDistance) / originalDistance) * 100)
    : 0;

  return { originalRoute, optimizedRoute, originalDistance, optimizedDistance, savedPct };
}

/* ------------------------------------------------------------------ */
/* Bottleneck detection                                               */
/* ------------------------------------------------------------------ */

export function detectBottleneck(input: {
  area: string;
  zone: string;
  avgTime: number;
  normalTime: number;
  threshold?: number;
}): { detected: boolean; pctIncrease: number; recommendation: string } | null {
  const threshold = input.threshold ?? 1.35;
  if (input.avgTime < input.normalTime * threshold) return null;
  const pctIncrease = Math.round(((input.avgTime - input.normalTime) / input.normalTime) * 100);
  const recommendation =
    `Reassign 2 workers from the least-loaded zone to ${input.zone === "B" ? "Zone B" : `Zone ${input.zone}`} to bring average ${input.area.toLowerCase()} time back under ${input.normalTime} min.`;
  return { detected: true, pctIncrease, recommendation };
}

/* ------------------------------------------------------------------ */
/* Warehouse efficiency score                                         */
/* ------------------------------------------------------------------ */

export interface EfficiencyInput {
  fulfillmentRate: number;
  onTimeDispatch: number;
  inventoryAccuracy: number;
  pickingEfficiency: number;
  packingEfficiency: number;
  exceptionResolution: number;
}

export function calculateWarehouseEfficiency(input: EfficiencyInput): {
  score: number;
  breakdown: { label: string; value: number; weight: number }[];
} {
  const weights: Record<string, number> = {
    Fulfillment: 0.25,
    Dispatch: 0.2,
    Inventory: 0.15,
    Picking: 0.15,
    Packing: 0.15,
    Exceptions: 0.1,
  };
  const values = {
    Fulfillment: input.fulfillmentRate,
    Dispatch: input.onTimeDispatch,
    Inventory: input.inventoryAccuracy,
    Picking: input.pickingEfficiency,
    Packing: input.packingEfficiency,
    Exceptions: input.exceptionResolution,
  };
  const breakdown = Object.entries(values).map(([label, value]) => ({
    label,
    value: Math.round(value),
    weight: weights[label],
  }));
  const score = Math.round(
    breakdown.reduce((s, b) => s + b.value * b.weight, 0),
  );
  return { score, breakdown };
}

/* ------------------------------------------------------------------ */
/* Explanation builder                                                */
/* ------------------------------------------------------------------ */

export function buildExplanation(parts: { label: string; detail: string }[]): string {
  return parts.map((p) => `${p.label}: ${p.detail}`).join("\n");
}
