import { mutation, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { calculateOrderPriority, optimizePickingRoute, reorderRecommendation } from "./decisionEngine";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/* deterministic RNG so the demo data is stable between reseeds */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ProductSeed {
  sku: string;
  name: string;
  category: string;
  price: number;
  daily: number;
  lead: number;
  location: string;
  stock?: number;
  damaged?: number;
  incoming?: number;
}

const PRODUCTS: ProductSeed[] = [
  { sku: "WH-204", name: "Wireless Headphones", category: "Audio", price: 2499, daily: 6, lead: 4, location: "B2", stock: 7 },
  { sku: "WH-103", name: "Bluetooth Earbuds", category: "Audio", price: 1599, daily: 12, lead: 3, location: "C1" },
  { sku: "SP-112", name: "Bluetooth Speaker", category: "Audio", price: 2199, daily: 9, lead: 4, location: "A1", damaged: 3 },
  { sku: "MC-301", name: "Mechanical Keyboard", category: "Computing", price: 3499, daily: 10, lead: 3, location: "B1" },
  { sku: "KB-102", name: "Wireless Keyboard", category: "Computing", price: 1299, daily: 11, lead: 3, location: "A2" },
  { sku: "MS-118", name: "Wireless Mouse", category: "Peripherals", price: 799, daily: 14, lead: 3, location: "A3", stock: 18 },
  { sku: "MS-240", name: "Ergonomic Mouse", category: "Peripherals", price: 1499, daily: 7, lead: 4, location: "C2" },
  { sku: "HUB-04", name: "USB-C Hub", category: "Connectivity", price: 1899, daily: 10, lead: 3, location: "B3", stock: 22, incoming: 40 },
  { sku: "MON-27", name: '27" QHD Monitor', category: "Displays", price: 18999, daily: 3, lead: 6, location: "A4", damaged: 1 },
  { sku: "WEB-08", name: "1080p Webcam", category: "Peripherals", price: 2499, daily: 8, lead: 4, location: "C3", damaged: 2 },
  { sku: "LS-212", name: "Laptop Stand", category: "Accessories", price: 1499, daily: 9, lead: 3, location: "B4" },
  { sku: "PB-104", name: "20000mAh Power Bank", category: "Power", price: 1999, daily: 8, lead: 4, location: "A5", damaged: 1 },
  { sku: "BC-110", name: "Barcode Scanner", category: "Equipment", price: 4999, daily: 4, lead: 5, location: "C4" },
  { sku: "TP-205", name: "Thermal Printer", category: "Equipment", price: 8999, daily: 5, lead: 5, location: "B5", stock: 12, incoming: 30 },
  { sku: "TAPE-50", name: "Packing Tape", category: "Packaging", price: 149, daily: 25, lead: 2, location: "A6", stock: 90 },
  { sku: "BOX-32", name: "Corrugated Box (M)", category: "Packaging", price: 89, daily: 30, lead: 2, location: "B6", stock: 80 },
  { sku: "CH-45", name: "65W USB-C Charger", category: "Power", price: 1299, daily: 12, lead: 3, location: "C5" },
  { sku: "SD-128", name: "128GB MicroSD Card", category: "Storage", price: 899, daily: 10, lead: 4, location: "A7", stock: 0, incoming: 50 },
  { sku: "SSD-1T", name: "1TB NVMe SSD", category: "Storage", price: 7499, daily: 4, lead: 5, location: "B7" },
  { sku: "RAM-16", name: "16GB DDR5 RAM", category: "Computing", price: 4499, daily: 5, lead: 4, location: "C6" },
  { sku: "CBL-2", name: "USB-C Cable 2m", category: "Accessories", price: 349, daily: 18, lead: 2, location: "A8", stock: 70 },
  { sku: "CBL-3", name: "HDMI Cable 3m", category: "Accessories", price: 449, daily: 15, lead: 2, location: "B8" },
  { sku: "CAM-4K", name: "4K Action Camera", category: "Cameras", price: 12999, daily: 2, lead: 7, location: "C7" },
  { sku: "DR-35", name: "Document Camera", category: "Cameras", price: 6999, daily: 3, lead: 6, location: "C8" },
  { sku: "PRJ-1", name: "Mini Projector", category: "Displays", price: 15999, daily: 2, lead: 7, location: "A3" },
  { sku: "PAD-11", name: "Drawing Tablet", category: "Peripherals", price: 8999, daily: 3, lead: 6, location: "B4" },
  { sku: "ST-5", name: "Stylus Pen", category: "Accessories", price: 499, daily: 6, lead: 4, location: "C5" },
  { sku: "FN-90", name: "Desk Fan", category: "Office", price: 1299, daily: 5, lead: 4, location: "A6" },
  { sku: "LT-300", name: "Desk Lamp", category: "Office", price: 1799, daily: 4, lead: 5, location: "B7" },
  { sku: "CHR-2", name: "Ergonomic Office Chair", category: "Furniture", price: 12499, daily: 1, lead: 10, location: "C8" },
  { sku: "DKS-3", name: "Standing Desk", category: "Furniture", price: 18999, daily: 1, lead: 12, location: "A1" },
  { sku: "MON-24", name: '24" FHD Monitor', category: "Displays", price: 10999, daily: 4, lead: 5, location: "B2" },
  { sku: "KB-87", name: "Tenkeyless Keyboard", category: "Computing", price: 2499, daily: 6, lead: 4, location: "C3" },
  { sku: "MS-66", name: "Trackball Mouse", category: "Peripherals", price: 2999, daily: 3, lead: 5, location: "A4" },
  { sku: "WH-510", name: "ANC Headphones", category: "Audio", price: 7999, daily: 5, lead: 4, location: "B5" },
  { sku: "SP-88", name: "Soundbar", category: "Audio", price: 5999, daily: 4, lead: 5, location: "C6" },
  { sku: "RT-6", name: "Wi-Fi 6 Router", category: "Networking", price: 3499, daily: 6, lead: 4, location: "A7" },
  { sku: "SW-16", name: "16-Port Network Switch", category: "Networking", price: 8999, daily: 2, lead: 7, location: "B8" },
  { sku: "AP-5", name: "Access Point", category: "Networking", price: 4999, daily: 3, lead: 6, location: "C1" },
  { sku: "MO-2", name: "XL Mousepad", category: "Accessories", price: 699, daily: 7, lead: 3, location: "A2" },
  { sku: "DB-2", name: "Docking Station", category: "Connectivity", price: 6499, daily: 4, lead: 5, location: "B3" },
  { sku: "TH-3", name: "Thunderbolt 4 Cable", category: "Connectivity", price: 999, daily: 5, lead: 4, location: "C4" },
  { sku: "BAG-15", name: "Laptop Backpack", category: "Mobility", price: 2499, daily: 6, lead: 4, location: "A5" },
  { sku: "BAG-11", name: "Laptop Sleeve", category: "Mobility", price: 999, daily: 7, lead: 3, location: "B6" },
  { sku: "KB-60", name: "60% Mechanical Keyboard", category: "Computing", price: 3999, daily: 5, lead: 4, location: "C7" },
  { sku: "GPU-1", name: "RTX Graphics Card", category: "Computing", price: 54999, daily: 1, lead: 14, location: "A8" },
  { sku: "CPU-1", name: "8-Core Processor", category: "Computing", price: 27999, daily: 1, lead: 12, location: "B1" },
  { sku: "PSU-750", name: "750W Power Supply", category: "Computing", price: 8999, daily: 2, lead: 8, location: "C2" },
  { sku: "CAB-6", name: "ATX Computer Case", category: "Computing", price: 5999, daily: 2, lead: 7, location: "A3" },
  { sku: "CH-45D", name: "Dual USB-C Charger", category: "Power", price: 1799, daily: 9, lead: 3, location: "B4" },
  { sku: "BAT-1", name: "AA Batteries (24 pack)", category: "Power", price: 549, daily: 16, lead: 2, location: "C5", stock: 60 },
  { sku: "CNV-1", name: "USB-C to HDMI Adapter", category: "Connectivity", price: 899, daily: 8, lead: 3, location: "A6" },
];

const CUSTOMERS: [string, string, string][] = [
  ["Aarti Mehta", "Platinum", "Mumbai"],
  ["Rohan Kapoor", "Premium", "Bengaluru"],
  ["Sneha Iyer", "Premium", "Chennai"],
  ["Vikram Singh", "Standard", "Delhi"],
  ["Priya Sharma", "Premium", "Pune"],
  ["Arjun Nair", "Standard", "Kochi"],
  ["Neha Gupta", "Platinum", "Gurugram"],
  ["Kabir Khan", "Standard", "Hyderabad"],
  ["Ishita Das", "Premium", "Kolkata"],
  ["Rahul Verma", "Basic", "Lucknow"],
  ["Ananya Rao", "Standard", "Ahmedabad"],
  ["Dev Patel", "Premium", "Surat"],
  ["Meera Joshi", "Standard", "Jaipur"],
  ["Karan Malhotra", "Platinum", "Chandigarh"],
];

const WORKERS: [string, string, string, number][] = [
  ["Ravi Kumar", "Picker", "B", 142],
  ["Sunita Rao", "Picker", "A", 128],
  ["Mohammed Ansari", "Picker", "C", 97],
  ["Priyanka Verma", "Picker", "B", 115],
  ["Arjun Mehta", "Packer", "Packing", 88],
  ["Lakshmi Nair", "Packer", "Packing", 76],
  ["Deepak Singh", "QC Inspector", "QC", 64],
  ["Kavita Joshi", "QC Inspector", "QC", 71],
  ["Sanjay Patil", "Dispatcher", "Dispatch", 55],
  ["Farhan Sheikh", "Picker", "B", 109],
];

/* order seed: [num, customer, items, deadlineHrs, createdMinAgo, status, extra] */
type OrderStatus =
  | "Pending"
  | "Picking"
  | "Packing"
  | "Quality Check"
  | "Ready to Dispatch"
  | "Dispatched"
  | "Delayed"
  | "Exception"
  | "Completed";
type InvStatus = "Available" | "Partial" | "Shortage" | "Backordered" | "Out";
type OrderSeed = [
  string,
  string,
  [string, number][],
  number,
  number,
  OrderStatus,
  Partial<{ invStatus: InvStatus; delayed: boolean; hasException: boolean }>?,
];

const ORDERS: OrderSeed[] = [
  ["ORD-1013", "Priya Sharma", [["MON-24", 1]], 30, 26 * 60, "Completed"],
  ["ORD-1014", "Neha Gupta", [["BAG-11", 3], ["ST-5", 4]], 32, 27 * 60, "Completed"],
  ["ORD-1015", "Rahul Verma", [["SD-128", 5]], 6, 90, "Pending", { invStatus: "Out" }],
  ["ORD-1016", "Sneha Iyer", [["WH-103", 2]], 3, 200, "Packing"],
  ["ORD-1017", "Aarti Mehta", [["LT-300", 2], ["FN-90", 2]], 2, 260, "Quality Check"],
  ["ORD-1018", "Rohan Kapoor", [["CAM-4K", 1]], 5, 240, "Picking"],
  ["ORD-1019", "Karan Malhotra", [["GPU-1", 1], ["PSU-750", 1]], 8, 75, "Pending"],
  ["ORD-1020", "Ishita Das", [["CH-45D", 2], ["CBL-3", 3]], 1, 320, "Ready to Dispatch"],
  ["ORD-1021", "Dev Patel", [["HUB-04", 2]], 4, 280, "Picking"],
  ["ORD-1022", "Ananya Rao", [["BAT-1", 3], ["MO-2", 2]], 12, 6 * 60, "Dispatched"],
  ["ORD-1023", "Arjun Nair", [["CNV-1", 4]], 14, 5 * 60, "Dispatched"],
  ["ORD-1024", "Kabir Khan", [["RT-6", 2]], 0.4, 320, "Delayed", { delayed: true, hasException: true }],
  ["ORD-1025", "Vikram Singh", [["KB-60", 1], ["MS-66", 1]], -0.6, 7 * 60, "Delayed", { delayed: true, hasException: true }],
  ["ORD-1026", "Neha Gupta", [["PRJ-1", 1]], 3, 300, "Exception", { hasException: true }],
  ["ORD-1027", "Rohan Kapoor", [["BAG-15", 2]], 5, 250, "Picking"],
  ["ORD-1028", "Aarti Mehta", [["DB-2", 1], ["TH-3", 2]], 4, 230, "Picking"],
  ["ORD-1029", "Priya Sharma", [["WH-510", 1]], 6, 220, "Picking"],
  ["ORD-1030", "Rahul Verma", [["CH-45", 3]], 3, 210, "Picking"],
  ["ORD-1031", "Sneha Iyer", [["MS-240", 1], ["WEB-08", 2]], 3, 190, "Exception", { hasException: true }],
  ["ORD-1032", "Karan Malhotra", [["MON-24", 2]], 2.5, 300, "Packing"],
  ["ORD-1033", "Meera Joshi", [["BOX-32", 20], ["TAPE-50", 5]], 6, 290, "Packing"],
  ["ORD-1034", "Dev Patel", [["WEB-08", 2], ["LS-212", 1]], 3.5, 270, "Packing"],
  ["ORD-1035", "Ananya Rao", [["SP-112", 2]], 4, 250, "Quality Check"],
  ["ORD-1036", "Kabir Khan", [["SSD-1T", 1], ["RAM-16", 2]], 5, 240, "Quality Check"],
  ["ORD-1037", "Arjun Nair", [["PB-104", 2]], 1.5, 230, "Ready to Dispatch"],
  ["ORD-1038", "Ishita Das", [["CBL-2", 5], ["TAPE-50", 10]], 1, 220, "Ready to Dispatch"],
  ["ORD-1039", "Vikram Singh", [["WH-103", 3]], 8, 140, "Dispatched"],
  ["ORD-1040", "Neha Gupta", [["MON-27", 1], ["CH-45", 2]], 3, 55, "Pending"],
  ["ORD-1041", "Priya Sharma", [["MC-301", 2], ["KB-102", 3]], 4, 50, "Pending"],
  ["ORD-1042", "Aarti Mehta", [["WH-204", 10]], 2.5, 42, "Pending", { invStatus: "Shortage" }],
  ["ORD-1043", "Dev Patel", [["CH-45D", 2]], 5, 38, "Pending"],
  ["ORD-1044", "Meera Joshi", [["CBL-2", 4], ["CBL-3", 2]], 7, 30, "Pending"],
  ["ORD-1045", "Karan Malhotra", [["MS-240", 1], ["MO-2", 2]], 4, 22, "Pending"],
  ["ORD-1046", "Sneha Iyer", [["SP-112", 2], ["ST-5", 3]], 6, 15, "Pending"],
  ["ORD-1047", "Ananya Rao", [["BOX-32", 10]], 9, 8, "Pending"],
  ["ORD-1048", "Vikram Singh", [["WH-204", 5]], 5, 30, "Pending", { invStatus: "Shortage" }],
];

const STAGE_ORDER = [
  { key: "created", label: "Order Created" },
  { key: "priority", label: "Priority Determined" },
  { key: "inventory", label: "Inventory Checked" },
  { key: "allocation", label: "Allocation" },
  { key: "picking", label: "Picking" },
  { key: "packing", label: "Packing" },
  { key: "qc", label: "Quality Check" },
  { key: "dispatch", label: "Dispatch" },
  { key: "completed", label: "Completed" },
];

function statusDoneCount(status: string): number {
  switch (status) {
    case "Completed":
    case "Dispatched":
      return 9;
    case "Ready to Dispatch":
      return 7;
    case "Quality Check":
      return 6;
    case "Packing":
      return 5;
    case "Picking":
    case "Delayed":
    case "Exception":
      return 4;
    default:
      return 3;
  }
}

function buildTimeline(
  status: string,
  createdAt: number,
  invStatus: string,
  orderNumber: string,
) {
  const done = statusDoneCount(status);
  return STAGE_ORDER.map((stage, i) => {
    let state: "done" | "partial" | "pending" = i < done ? "done" : "pending";
    let note: string | undefined;
    if (stage.key === "allocation" && (invStatus === "Shortage" || invStatus === "Partial" || invStatus === "Backordered" || invStatus === "Out")) {
      if (i < done) state = "partial";
      else state = "partial";
      note = invStatus === "Out" ? "No stock available" : "Insufficient stock — allocation pending";
    }
    if (stage.key === "inventory" && (invStatus === "Shortage" || invStatus === "Out")) {
      note = invStatus === "Out" ? "Stockout detected" : "Shortage detected";
    }
    return {
      key: stage.key,
      label: stage.label,
      state,
      at: createdAt + i * 3 * MIN,
      ...(note ? { note } : {}),
    };
  });
}

async function seedInternal(ctx: MutationCtx, now: number) {
  const rng = mulberry32(20260207);

  /* ---------------- products + inventory ---------------- */
  const productId: Record<string, Id<"products">> = {};
  const initialStock: Record<string, number> = {};
  for (const p of PRODUCTS) {
    const reorderLevel = Math.ceil(p.daily * p.lead + Math.max(8, Math.ceil(p.daily * 2)));
    const id = await ctx.db.insert("products", {
      sku: p.sku,
      name: p.name,
      category: p.category,
      price: p.price,
      zone: p.location.charAt(0),
      location: p.location,
      avgDailyDemand: p.daily,
      leadTimeDays: p.lead,
      safetyStock: Math.max(8, Math.ceil(p.daily * 2)),
      reorderLevel,
      unit: "pcs",
    });
    productId[p.sku] = id;

    const stock =
      p.stock ??
      Math.ceil((reorderLevel + 40 + rng() * 220) / 5) * 5;
    initialStock[p.sku] = stock;
    await ctx.db.insert("inventory", {
      productId: id,
      available: stock,
      reserved: 0,
      damaged: p.damaged ?? 0,
      incoming: p.incoming ?? 0,
    });
  }

  /* ---------------- customers + workers ---------------- */
  const customerId: Record<string, Id<"customers">> = {};
  for (const [name, tier, city] of CUSTOMERS) {
    customerId[name] = await ctx.db.insert("customers", { name, tier, city });
  }
  const workerIds: Id<"workers">[] = [];
  for (const [name, role, zone, tasks] of WORKERS) {
    workerIds.push(
      await ctx.db.insert("workers", {
        name,
        role,
        zone,
        active: true,
        tasksCompleted: tasks,
        avgPickTimeMin: 9 + rng() * 6,
      }),
    );
  }
  const pickers = workerIds.slice(0, 5).concat(workerIds[9]);
  const packers = [workerIds[4], workerIds[5]];
  const qcWorkers = [workerIds[6], workerIds[7]];
  const dispatcher = workerIds[8];

  /* ---------------- orders ---------------- */
  const pool: Record<string, number> = { ...initialStock };
  pool["WH-204"] = 7;
  pool["MS-118"] = 18;
  pool["HUB-04"] = 22;
  pool["TP-205"] = 12;
  pool["SD-128"] = 0;
  pool["BAT-1"] = 60;
  pool["TAPE-50"] = 90;
  pool["BOX-32"] = 80;
  pool["CBL-2"] = 70;

  const orderIdByNumber: Record<string, Id<"orders">> = {};
  const inFlight: { orderNumber: string; orderId: Id<"orders">; status: OrderStatus; createdAt: number }[] = [];

  // generate older completed orders 1001–1012
  for (let i = 1; i <= 12; i++) {
    const num = `ORD-${String(1000 + i)}`;
    const [cname] = CUSTOMERS[Math.floor(rng() * CUSTOMERS.length)];
    const itemCount = 1 + Math.floor(rng() * 3);
    const chosen = new Set<number>();
    const items: [string, number][] = [];
    while (items.length < itemCount) {
      const idx = Math.floor(rng() * PRODUCTS.length);
      if (chosen.has(idx)) continue;
      chosen.add(idx);
      items.push([PRODUCTS[idx].sku, 1 + Math.floor(rng() * 3)]);
    }
    const daysAgo = Math.floor(rng() * 12) + 1;
    const createdAt = now - daysAgo * DAY - Math.floor(rng() * 8) * HOUR;
    const deadline = createdAt + (4 + rng() * 20) * HOUR;
    const value = items.reduce((s, [sku, qty]) => s + (PRODUCTS.find((p) => p.sku === sku)!.price * qty), 0);
    const prio = calculateOrderPriority({
      customerTier: CUSTOMERS.find((c) => c[0] === cname)![1],
      deadline,
      createdAt,
      value,
      inventoryStatus: "Available",
      now,
    });
    const timeline = STAGE_ORDER.map((s, i) => ({ key: s.key, label: s.label, state: "done" as const, at: createdAt + i * 4 * MIN }));
    const id = await ctx.db.insert("orders", {
      orderNumber: num,
      customerId: customerId[cname],
      items: items.map(([sku, qty]) => ({ productId: productId[sku], qty, allocated: qty, fulfilled: qty })),
      value,
      priorityScore: prio.score,
      priorityLevel: prio.level,
      priorityReasons: prio.reasons.map((r) => `${r.points > 0 ? "+" : ""}${r.points} ${r.label}`),
      deadline,
      createdAt,
      status: "Completed",
      inventoryStatus: "Available",
      timeline,
      delayed: false,
      hasException: false,
      completedAt: createdAt + (5 + rng() * 8) * HOUR,
    });
    orderIdByNumber[num] = id;
  }

  // in-flight orders with live allocation
  for (const [num, cname, items, deadlineHrs, createdMinAgo, status, extra] of ORDERS) {
    const createdAt = now - createdMinAgo * MIN;
    const deadline = now + deadlineHrs * HOUR;
    const invStatus: InvStatus = extra?.invStatus ?? "Available";
    const value = items.reduce((s, [sku, qty]) => s + PRODUCTS.find((p) => p.sku === sku)!.price * qty, 0);
    const tier = CUSTOMERS.find((c) => c[0] === cname)![1];
    const prio = calculateOrderPriority({ customerTier: tier, deadline, createdAt, value, inventoryStatus: invStatus, now });

    // allocate from pool unless this order is part of the demo conflict
    const skipAlloc = invStatus === "Shortage" || invStatus === "Out";
    const allocatedItems = items.map(([sku, qty]) => {
      let allocated = 0;
      if (!skipAlloc) {
        allocated = Math.min(qty, pool[sku] ?? 0);
        pool[sku] = (pool[sku] ?? 0) - allocated;
      }
      const fulfilled = status === "Dispatched" || status === "Completed" ? allocated : 0;
      return { productId: productId[sku], qty, allocated, fulfilled };
    });
    const hasShortage = allocatedItems.some((it) => it.allocated < it.qty);

    const timeline = buildTimeline(status, createdAt, invStatus, num);
    const completedAt = status === "Completed" || status === "Dispatched" ? now - Math.floor(rng() * 40) * MIN : undefined;

    const id = await ctx.db.insert("orders", {
      orderNumber: num,
      customerId: customerId[cname],
      items: allocatedItems,
      value,
      priorityScore: prio.score,
      priorityLevel: prio.level,
      priorityReasons: prio.reasons.map((r) => `${r.points > 0 ? "+" : ""}${r.points} ${r.label}`),
      deadline,
      createdAt,
      status,
      inventoryStatus: hasShortage && !skipAlloc ? "Partial" : invStatus,
      timeline,
      delayed: extra?.delayed ?? false,
      hasException: extra?.hasException ?? false,
      ...(completedAt ? { completedAt } : {}),
    });
    orderIdByNumber[num] = id;
    inFlight.push({ orderNumber: num, orderId: id, status, createdAt });
  }

  // refresh inventory from pool
  for (const p of PRODUCTS) {
    const inv = await ctx.db
      .query("inventory")
      .withIndex("by_product", (q) => q.eq("productId", productId[p.sku]))
      .first();
    const initial = initialStock[p.sku] ?? 0;
    const used = Math.max(0, initial - (pool[p.sku] ?? 0));
    if (inv) {
      await ctx.db.patch(inv._id, { available: pool[p.sku] ?? 0, reserved: used });
    }
  }

  /* ---------------- picking / packing / qc / dispatch tasks ---------------- */
  let pickIdx = 0;
  let packIdx = 0;
  let qcIdx = 0;
  let ptNum = 1031;
  let pkNum = 101;
  let qcNum = 501;
  let dNum = 701;

  for (const { orderNumber, orderId, status } of inFlight) {
    const order = await ctx.db.get(orderId);
    if (!order) continue;

    const needsPicking = ["Picking", "Packing", "Quality Check", "Ready to Dispatch"].includes(status);
    const needsPacking = ["Packing", "Quality Check", "Ready to Dispatch"].includes(status);
    const needsQc = ["Quality Check", "Ready to Dispatch"].includes(status);
    const needsDispatchReady = status === "Ready to Dispatch";
    const needsDispatchDone = status === "Dispatched" || status === "Completed";

    if (needsPicking) {
      const workerId = pickers[pickIdx % pickers.length];
      pickIdx++;
      const locs: string[] = [];
      for (const item of order.items) {
        const prod = await ctx.db.get(item.productId);
        if (prod && !locs.includes(prod.location)) locs.push(prod.location);
      }
      const route = optimizePickingRoute(locs);
      const pickingStatus = status === "Picking" ? "In Progress" : "Completed";
      await ctx.db.insert("pickingTasks", {
        taskId: `PT-${ptNum++}`,
        orderId,
        workerId,
        items: order.items,
        locations: locs,
        route: route.optimizedRoute,
        originalDistance: route.originalDistance,
        optimizedDistance: route.optimizedDistance,
        savedPct: route.savedPct,
        status: pickingStatus,
        startedAt: pickingStatus === "In Progress" ? now - 25 * MIN : now - 90 * MIN,
        completedAt: pickingStatus === "Completed" ? now - 70 * MIN : undefined,
        assignedAt: now - 100 * MIN,
      });
    }

    if (needsPacking) {
      const workerId = packers[packIdx % packers.length];
      packIdx++;
      const packingStatus = status === "Packing" ? "In Progress" : "Completed";
      await ctx.db.insert("packingTasks", {
        taskId: `PK-${pkNum++}`,
        orderId,
        station: workerId === packers[0] ? "Packing Station 1" : "Packing Station 2",
        workerId,
        status: packingStatus,
        startedAt: packingStatus === "In Progress" ? now - 18 * MIN : now - 85 * MIN,
        completedAt: packingStatus === "Completed" ? now - 60 * MIN : undefined,
      });
    }

    if (needsQc) {
      const inspectorId = qcWorkers[qcIdx % qcWorkers.length];
      qcIdx++;
      const qcStatus = status === "Quality Check" ? "Pending" : "Passed";
      await ctx.db.insert("qcTasks", {
        taskId: `QC-${qcNum++}`,
        orderId,
        status: qcStatus,
        inspectorId: qcStatus === "Passed" ? inspectorId : undefined,
        inspectedAt: qcStatus === "Passed" ? now - 40 * MIN : undefined,
      });
    }

    if (needsDispatchReady || (needsDispatchDone && status === "Dispatched")) {
      const customer = await ctx.db.get(order.customerId);
      await ctx.db.insert("dispatchRecords", {
        dispatchId: `DS-${dNum++}`,
        orderId,
        carrier: ["BlueDart", "Delhivery", "DTDC", "Ekart"][dNum % 4],
        packageWeight: `${(0.5 + (order.value % 18) / 10).toFixed(1)} kg`,
        destination: customer?.city ?? "Bengaluru",
        deadline: order.deadline,
        status: needsDispatchReady ? "Ready" : "Dispatched",
        dispatchedAt: needsDispatchReady ? undefined : order.completedAt ?? now - 30 * MIN,
      });
    }
  }

  /* ---------------- exceptions ---------------- */
  const exId = async (
    exceptionId: string,
    type: string,
    severity: "Critical" | "High" | "Medium" | "Low",
    orderNumber: string | undefined,
    sku: string | undefined,
    quantity: number | undefined,
    description: string,
    impact: string,
    aiRecommendation: string,
    status: "Open" | "Resolved",
    createdAt: number,
    history: [string, number][],
    resolution?: string,
  ) => {
    return ctx.db.insert("exceptions", {
      exceptionId,
      type,
      severity,
      orderId: orderNumber ? orderIdByNumber[orderNumber] : undefined,
      productId: sku ? productId[sku] : undefined,
      sku,
      quantity,
      description,
      impact,
      aiRecommendation,
      status,
      decisionHistory: history.map(([stage, at]) => ({ stage, at })),
      createdAt,
      resolvedAt: status === "Resolved" ? createdAt + 40 * MIN : undefined,
      resolution,
    });
  };

  await exId("EX-101", "Dispatch delay", "Medium", "ORD-1011", undefined, undefined,
    "Carrier pickup delayed by 40 minutes due to vehicle breakdown.",
    "Delivery SLA at risk for 1 order.",
    "Escalated to alternate carrier — order dispatched 35 minutes behind schedule.",
    "Resolved", now - 5 * HOUR,
    [["Detected", now - 5 * HOUR], ["Analyzed", now - 4.8 * HOUR], ["Recommended", now - 4.7 * HOUR], ["Approved", now - 4.6 * HOUR], ["Executed", now - 4.5 * HOUR], ["Resolved", now - 4.4 * HOUR]],
    "Dispatched via backup carrier.");

  await exId("EX-102", "Stock shortage", "Critical", "ORD-1042", "WH-204", 10,
    "Order requires 10 units of Wireless Headphones but only 7 are available.",
    "Critical order cannot be fully fulfilled — stockout risk in 1 day.",
    "Allocate all 7 available units to ORD-1042 (Critical priority), hold ORD-1048, backorder 3 units and create a replenishment request.",
    "Open", now - 40 * MIN,
    [["Detected", now - 40 * MIN], ["Analyzed", now - 39 * MIN], ["Recommended", now - 38 * MIN]]);

  await exId("EX-103", "Missing item", "High", "ORD-1026", "PRJ-1", 1,
    "Mini Projector scanned as missing during picking in Zone C.",
    "Order #1026 held in exception queue — Platinum customer at risk.",
    "Verify count in Zone C receiving; if confirmed missing, dispatch from Zone A reserve within 2 hours.",
    "Open", now - 3.2 * HOUR,
    [["Detected", now - 3.2 * HOUR], ["Analyzed", now - 3.1 * HOUR], ["Recommended", now - 3.05 * HOUR]]);

  await exId("EX-104", "Damaged item", "High", "ORD-1031", "WEB-08", 1,
    "Product packaging damaged during picking (camera box crushed).",
    "1 unit unsellable — order #1031 waiting for replacement.",
    "Replace item using available inventory from Zone C and return damaged unit to QA for inspection.",
    "Open", now - 2.1 * HOUR,
    [["Detected", now - 2.1 * HOUR], ["Analyzed", now - 2.05 * HOUR], ["Recommended", now - 2.0 * HOUR]]);

  await exId("EX-105", "QC failure", "Medium", "ORD-1012", "SP-112", 1,
    "Speaker failed audio output test during quality check.",
    "1 unit quarantined — order re-picked from healthy stock.",
    "Re-pick unit from Zone A and re-run QC — no customer impact expected.",
    "Resolved", now - 26 * HOUR,
    [["Detected", now - 26 * HOUR], ["Analyzed", now - 25.8 * HOUR], ["Recommended", now - 25.7 * HOUR], ["Approved", now - 25.5 * HOUR], ["Executed", now - 25.3 * HOUR], ["Resolved", now - 25 * HOUR]],
    "Re-picked and passed QC.");

  await exId("EX-106", "Picking delay", "Medium", "ORD-1024", "RT-6", undefined,
    "Picking task exceeded 25-minute SLA in Zone B.",
    "Order #1024 approaching dispatch deadline.",
    "Reassign task to worker with shortest queue — estimated recovery in 25 minutes.",
    "Open", now - 55 * MIN,
    [["Detected", now - 55 * MIN], ["Analyzed", now - 52 * MIN], ["Recommended", now - 50 * MIN]]);

  await exId("EX-107", "Packing error", "Low", "ORD-1010", "BOX-32", undefined,
    "Wrong box size used — packing station flagged dimensional mismatch.",
    "Minor cost impact only; order re-packed correctly.",
    "Re-pack with correct box size and update packing SOP for large orders.",
    "Resolved", now - 30 * HOUR,
    [["Detected", now - 30 * HOUR], ["Analyzed", now - 29.8 * HOUR], ["Recommended", now - 29.7 * HOUR], ["Approved", now - 29.5 * HOUR], ["Executed", now - 29.2 * HOUR], ["Resolved", now - 29 * HOUR]],
    "Re-packed; SOP updated.");

  await exId("EX-108", "Stockout", "Critical", "ORD-1015", "SD-128", 5,
    "SKU SD-128 has 0 units available — order cannot be allocated.",
    "Order #1015 blocked; inbound stock arrives in 4 days.",
    "Split order: dispatch available lines now, ship SD-128 when inbound arrives (ETA 4 days).",
    "Open", now - 85 * MIN,
    [["Detected", now - 85 * MIN], ["Analyzed", now - 82 * MIN], ["Recommended", now - 80 * MIN]]);

  await exId("EX-109", "Allocation conflict", "Medium", "ORD-1013", "WH-103", undefined,
    "Two orders competed for the last 12 units of WH-103.",
    "Resolved by priority scoring — no SLA impact.",
    "Priority-based allocation applied; lower-priority order fulfilled from next inbound batch.",
    "Resolved", now - 26 * HOUR,
    [["Detected", now - 26 * HOUR], ["Analyzed", now - 25.9 * HOUR], ["Recommended", now - 25.8 * HOUR], ["Approved", now - 25.6 * HOUR], ["Executed", now - 25.4 * HOUR], ["Resolved", now - 25.2 * HOUR]],
    "Allocation applied automatically.");

  await exId("EX-110", "Dispatch delay", "High", "ORD-1025", undefined, undefined,
    "Dispatch window missed — carrier cut-off passed for today.",
    "Order #1025 delayed; customer notified.",
    "Dispatch with next carrier slot at 6:00 PM or offer customer self-pickup.",
    "Open", now - 3.5 * HOUR,
    [["Detected", now - 3.5 * HOUR], ["Analyzed", now - 3.4 * HOUR], ["Recommended", now - 3.3 * HOUR]]);

  /* ---------------- decisions ---------------- */
  const dec1042 = orderIdByNumber["ORD-1042"];
  const wh204 = productId["WH-204"];
  await ctx.db.insert("decisions", {
    decisionId: "AI-203",
    type: "allocation",
    problem: "Inventory conflict — Wireless Headphones (WH-204)",
    analysis:
      "ORD-1042 (Critical, score 95) requires 10 units. ORD-1048 (High, score 76) requires 5 units. Only 7 units available. Ranking competing orders by priority score determines the optimal allocation.",
    recommendation:
      "Allocate all 7 available units to ORD-1042, hold ORD-1048, backorder 3 units and create a replenishment request for WH-204.",
    expectedImpact: [
      "Critical order partially fulfilled (7 of 10 units)",
      "ORD-1048 delayed until restock",
      "Stockout prevented from affecting the highest-priority order",
      "Replenishment request created for WH-204",
    ],
    relatedOrderId: dec1042,
    relatedProductId: wh204,
    status: "Pending",
    createdAt: now - 38 * MIN,
  });

  await ctx.db.insert("decisions", {
    decisionId: "AI-204",
    type: "bottleneck",
    problem: "Picking bottleneck — Zone B",
    analysis:
      "Average pick time in Zone B is 14.8 min vs a 9.5 min baseline (+56%). Zone B handles 40% of today's pick volume with 3 of 6 pickers assigned.",
    recommendation: "Move two available workers from Zone C to Zone B.",
    expectedImpact: [
      "Estimated picking time reduction: 18–25%",
      "Zone B queue clears in roughly 40 minutes",
      "Zone C absorbs remaining load with existing capacity",
    ],
    status: "Pending",
    createdAt: now - 52 * MIN,
  });

  await ctx.db.insert("decisions", {
    decisionId: "AI-201",
    type: "damage",
    problem: "Damaged item — WEB-08 (ORD-1031)",
    analysis: "Packaging damage detected during picking. One unit is unsellable and must be replaced before dispatch.",
    recommendation: "Replace item using available inventory from Zone C and flag damaged unit for QA.",
    expectedImpact: ["Order #1031 dispatch delayed by 20 minutes", "Damaged unit quarantined"],
    relatedExceptionId: undefined,
    status: "Applied",
    createdAt: now - 2.1 * HOUR,
    resolvedAt: now - 1.9 * HOUR,
  });

  await ctx.db.insert("decisions", {
    decisionId: "AI-202",
    type: "reorder",
    problem: "Reorder recommended — Wireless Mouse (MS-118)",
    analysis: "Stock of 18 units is below the reorder point of 70 with daily demand of 14 units.",
    recommendation: "Create purchase order for 130 units of MS-118.",
    expectedImpact: ["Stockout prevented for 9+ days", "Safety stock restored"],
    status: "Applied",
    createdAt: now - 20 * HOUR,
    resolvedAt: now - 19.5 * HOUR,
  });

  /* ---------------- reorders ---------------- */
  const recFor = async (sku: string) => {
    const prod = PRODUCTS.find((p) => p.sku === sku)!;
    const inv = await ctx.db.query("inventory").withIndex("by_product", (q) => q.eq("productId", productId[sku])).first();
    if (!inv) return null;
    return reorderRecommendation({
      avgDailyDemand: prod.daily,
      leadTimeDays: prod.lead,
      safetyStock: Math.max(8, Math.ceil(prod.daily * 2)),
      available: inv.available,
      incoming: inv.incoming,
    });
  };

  const rWh = await recFor("WH-204");
  if (rWh) {
    await ctx.db.insert("reorders", {
      productId: wh204,
      quantity: rWh.recommended,
      reason: rWh.reason,
      status: "Pending",
      createdAt: now - 38 * MIN,
    });
  }
  const rMs = await recFor("MS-118");
  if (rMs) {
    await ctx.db.insert("reorders", {
      productId: productId["MS-118"],
      quantity: rMs.recommended,
      reason: rMs.reason,
      status: "Pending",
      createdAt: now - 20 * HOUR,
    });
  }
  const rTp = await recFor("TP-205");
  if (rTp) {
    await ctx.db.insert("reorders", {
      productId: productId["TP-205"],
      quantity: rTp.recommended,
      reason: rTp.reason,
      status: "Created",
      createdAt: now - 12 * HOUR,
    });
  }
  const rSd = await recFor("SD-128");
  if (rSd) {
    await ctx.db.insert("reorders", {
      productId: productId["SD-128"],
      quantity: rSd.recommended,
      reason: rSd.reason,
      status: "Created",
      createdAt: now - 30 * HOUR,
    });
  }

  /* ---------------- bottlenecks ---------------- */
  await ctx.db.insert("bottlenecks", {
    bottleneckId: "BN-1",
    area: "Picking",
    zone: "B",
    avgTime: 14.8,
    normal: 9.5,
    pctIncrease: 56,
    recommendation: "Reassign 2 workers from Zone C to Zone B.",
    status: "Active",
    createdAt: now - 50 * MIN,
  });
  await ctx.db.insert("bottlenecks", {
    bottleneckId: "BN-2",
    area: "Packing",
    zone: "Station 2",
    avgTime: 8.9,
    normal: 7.2,
    pctIncrease: 24,
    recommendation: "Balance workload across packing stations.",
    status: "Resolved",
    createdAt: now - 26 * HOUR,
  });

  /* ---------------- activity feed ---------------- */
  const act = async (type: "success" | "warning" | "error" | "info", message: string, minsAgo: number, orderNumber?: string) => {
    await ctx.db.insert("activityLog", { type, message, orderNumber, at: now - minsAgo * MIN });
  };
  await act("warning", "Order ORD-1042 requires partial allocation (10 needed, 7 available)", 2, "ORD-1042");
  await act("error", "SKU WH-204 is critically low — below reorder level", 4);
  await act("success", "Order ORD-1039 dispatched via BlueDart", 7, "ORD-1039");
  await act("error", "Damaged item reported — WEB-08 (ORD-1031)", 10, "ORD-1031");
  await act("success", "Order ORD-1038 moved to Ready to Dispatch", 13, "ORD-1038");
  await act("info", "Picking task PT-1032 completed (12% route saving)", 16);
  await act("warning", "Zone B picking average exceeds threshold (14.8 min)", 20);
  await act("success", "Order ORD-1036 passed quality check", 24, "ORD-1036");
  await act("info", "Reorder R-106 created for TP-205 (20 units)", 28);
  await act("warning", "Stockout risk — SD-128 has 0 units available", 33);
  await act("success", "Order ORD-1013 completed — fulfillment confirmed", 38, "ORD-1013");
  await act("info", "3 workers started shift in Zone A", 45);

  /* ---------------- notifications ---------------- */
  const notif = async (severity: "critical" | "warning" | "info" | "success", message: string, minsAgo: number, read = false) => {
    await ctx.db.insert("notifications", { severity, message, read, at: now - minsAgo * MIN });
  };
  await notif("critical", "Stockout: SD-128 (128GB MicroSD) is out of stock", 33);
  await notif("warning", "Order ORD-1042 deadline is in under 3 hours", 30);
  await notif("warning", "Picking bottleneck detected in Zone B (+56% avg time)", 50);
  await notif("critical", "Damaged item: WEB-08 packaging damaged (ORD-1031)", 10);
  await notif("success", "Order ORD-1039 dispatched", 7);
  await notif("warning", "WH-204 below reorder level — 7 units left", 4);
  await notif("info", "Quality check passed for ORD-1036", 24);
  await notif("critical", "Inventory conflict: WH-204 demand exceeds supply", 2);
  await notif("info", "Reorder created for TP-205 (20 units)", 28, true);

  /* ---------------- metrics (14 days, sum of orders = 1248) ---------------- */
  const dailyOrders = [96, 90, 98, 88, 100, 94, 90, 96, 92, 99, 86, 94, 87, 38];
  for (let i = 0; i < dailyOrders.length; i++) {
    const orders = dailyOrders[i];
    const fulfillmentRate = i === dailyOrders.length - 1
      ? 94.7
      : Math.round((91 + rng() * 6) * 10) / 10;
    const fulfilled = Math.round((orders * fulfillmentRate) / 100);
    await ctx.db.insert("metrics", {
      day: dailyOrders.length - 1 - i,
      orders,
      fulfilled,
      stockouts: i === 12 ? 3 : Math.floor(rng() * 2.5),
      exceptions: 1 + Math.floor(rng() * 3.5),
      pickTimeMin: Math.round((8.5 + rng() * 6.5) * 10) / 10,
      packTimeMin: Math.round((5.5 + rng() * 3.5) * 10) / 10,
      dispatchOnTimePct: Math.round((88 + rng() * 9) * 10) / 10,
      fulfillmentRate,
      zoneA: Math.round(60 + rng() * 35),
      zoneB: Math.round(60 + rng() * 35),
      zoneC: Math.round(55 + rng() * 35),
    });
  }

  return { productCount: PRODUCTS.length, orderCount: 12 + ORDERS.length };
}

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    return seedInternal(ctx, Date.now());
  },
});

/** Called on app boot — seeds once, no-ops if data already exists. */
export const ensureSeeded = mutation({
  args: {},
  handler: async (ctx) => {
    const first = await ctx.db.query("products").first();
    if (first) return false;
    await seedInternal(ctx, Date.now());
    return true;
  },
});

export type SeedResult = Awaited<ReturnType<typeof seedInternal>>;
