import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, MutationCtx } from "./_generated/server";
import {
  allocateInventory,
  reorderRecommendation,
  type AllocResult,
} from "./decisionEngine";

const MIN = 60_000;
const HOUR = 3_600_000;

/* ---------------- internal helpers ---------------- */

async function log(
  ctx: MutationCtx,
  type: "success" | "warning" | "error" | "info",
  message: string,
  orderNumber?: string,
) {
  await ctx.db.insert("activityLog", { type, message, orderNumber, at: Date.now() });
}

async function notify(
  ctx: MutationCtx,
  severity: "critical" | "warning" | "info" | "success",
  message: string,
) {
  await ctx.db.insert("notifications", { severity, message, read: false, at: Date.now() });
}

async function nextNumber(ctx: MutationCtx, table: "exceptions" | "decisions", prefix: string): Promise<string> {
  const all = await ctx.db.query(table).collect();
  let max = 0;
  for (const row of all) {
    const id =
      (row as { exceptionId?: string }).exceptionId ??
      (row as { decisionId?: string }).decisionId ??
      "";
    const m = /(\d+)$/.exec(id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${max + 1}`;
}

async function nextTaskId(
  ctx: MutationCtx,
  table: "pickingTasks" | "packingTasks" | "qcTasks" | "dispatchRecords",
  field: "taskId" | "dispatchId",
  prefix: string,
): Promise<string> {
  const all = await ctx.db.query(table).collect();
  let max = 0;
  for (const row of all) {
    const m = /(\d+)$/.exec(String((row as unknown as Record<string, unknown>)[field] ?? ""));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${max + 1}`;
}

async function resolveExceptionForDecision(ctx: MutationCtx, decisionId: Id<"decisions">, now: number, resolution: string) {
  const decision = await ctx.db.get(decisionId);
  if (!decision) return;
  let ex = decision.relatedExceptionId ? await ctx.db.get(decision.relatedExceptionId) : undefined;
  if (!ex && decision.relatedProductId) {
    ex = (await ctx.db.query("exceptions").collect()).find(
      (e) => e.productId === decision.relatedProductId && e.status === "Open",
    );
  }
  if (ex) {
    await ctx.db.patch(ex._id, {
      status: "Resolved",
      resolvedAt: now,
      resolution,
      decisionHistory: [...ex.decisionHistory, { stage: "Approved", at: now }, { stage: "Executed", at: now }, { stage: "Resolved", at: now }],
    });
    const order = ex.orderId ? await ctx.db.get(ex.orderId) : undefined;
    if (order) {
      const stillOpen = (await ctx.db.query("exceptions").collect()).some(
        (e) => e.orderId === order._id && e.status === "Open",
      );
      if (!stillOpen) await ctx.db.patch(order._id, { hasException: false });
    }
  }
}

/** Core allocation pass — shared by runAllocation and applyDecision("allocation"). */
async function performAllocation(ctx: MutationCtx): Promise<AllocResult & { appliedDecisionIds: string[] }> {
  const now = Date.now();
  const orders = await ctx.db.query("orders").collect();
  const inventory = await ctx.db.query("inventory").collect();
  const products = await ctx.db.query("products").collect();

  const open = orders.filter((o) => !["Completed", "Dispatched"].includes(o.status));
  const pool: Record<string, number> = {};
  for (const inv of inventory) pool[inv.productId] = inv.available;
  const names: Record<string, string> = {};
  for (const p of products) names[p._id] = p.sku;

  const competing = open.map((o) => ({
    orderId: o._id,
    orderNumber: o.orderNumber,
    priorityScore: o.priorityScore,
    priorityLevel: o.priorityLevel,
    items: o.items.map((i) => ({ productId: i.productId, qty: i.qty, allocated: i.allocated })),
  }));

  const result = allocateInventory({ orders: competing, stock: pool, names, now });

  // apply allocations
  for (const a of result.allocations) {
    const order = await ctx.db.get(a.orderId as Id<"orders">);
    if (!order) continue;
    const items = order.items.map((i) =>
      i.productId === a.productId ? { ...i, allocated: Math.min(i.qty, i.allocated + a.allocated) } : i,
    );
    const inv = await ctx.db
      .query("inventory")
      .withIndex("by_product", (q) => q.eq("productId", a.productId as Id<"products">))
      .first();
    if (inv) {
      await ctx.db.patch(inv._id, {
        available: Math.max(0, inv.available - a.allocated),
        reserved: inv.reserved + a.allocated,
      });
    }
    const allFulfilled = items.every((i) => i.allocated >= i.qty);
    const anyAllocated = items.some((i) => i.allocated > 0);
    const newInvStatus = allFulfilled ? "Available" : anyAllocated ? "Partial" : "Shortage";
    const timeline = order.timeline.map((t) =>
      t.key === "allocation" ? { ...t, state: newInvStatus === "Available" ? ("done" as const) : ("partial" as const), at: now } : t,
    );
    await ctx.db.patch(order._id, { items, inventoryStatus: newInvStatus, timeline });
  }

  // hold lower-priority orders that received nothing
  for (const hold of result.holds) {
    const num = hold.split(" ")[0];
    const order = orders.find((o) => o.orderNumber === num);
    if (order && order.inventoryStatus === "Available") {
      await ctx.db.patch(order._id, { inventoryStatus: "Shortage", hasException: true });
    }
  }

  // exceptions for shortages (one per product)
  const appliedDecisionIds: string[] = [];
  for (const s of result.productShortages) {
    const affected = orders
      .filter((o) => !["Completed", "Dispatched"].includes(o.status) && o.items.some((i) => i.productId === s.productId && i.allocated < i.qty))
      .sort((a, b) => b.priorityScore - a.priorityScore);
    const top = affected[0];
    if (!top) continue;
    const exists = (await ctx.db.query("exceptions").collect()).some(
      (e) => e.productId === s.productId && e.type === "Stock shortage" && e.status === "Open",
    );
    if (exists) continue;
    const exId = await nextNumber(ctx, "exceptions", "EX-");
    await ctx.db.insert("exceptions", {
      exceptionId: exId,
      type: "Stock shortage",
      severity: top.priorityLevel === "Critical" ? "Critical" : "High",
      orderId: top._id,
      productId: s.productId as Id<"products">,
      sku: s.sku,
      quantity: s.short,
      description: `Allocation conflict: ${s.short} units of ${s.sku} remain unfulfilled after priority allocation.`,
      impact: `${top.orderNumber} (${top.priorityLevel}) cannot be fully fulfilled.`,
      aiRecommendation: `Prioritize ${top.orderNumber} and create a replenishment request for ${s.short} units of ${s.sku}.`,
      status: "Open",
      decisionHistory: [
        { stage: "Detected", at: now },
        { stage: "Analyzed", at: now },
        { stage: "Recommended", at: now },
      ],
      createdAt: now,
    });
  }

  // replenishment recommendations for products below reorder level
  for (const s of result.productShortages) {
    const product = await ctx.db.get(s.productId as Id<"products">);
    if (!product) continue;
    const inv = await ctx.db
      .query("inventory")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .first();
    if (!inv) continue;
    const rec = reorderRecommendation({
      avgDailyDemand: product.avgDailyDemand,
      leadTimeDays: product.leadTimeDays,
      safetyStock: product.safetyStock,
      available: inv.available,
      incoming: inv.incoming,
    });
    if (!rec) continue;
    const existing = (await ctx.db.query("reorders").collect()).find((r) => r.productId === product._id && r.status === "Pending");
    if (existing) continue;
    await ctx.db.insert("reorders", {
      productId: product._id,
      quantity: rec.recommended,
      reason: rec.reason,
      status: "Pending",
      createdAt: now,
    });
  }

  // apply any pending allocation decisions that match this run
  const decisions = await ctx.db.query("decisions").collect();
  for (const d of decisions) {
    if (d.type !== "allocation" || d.status !== "Pending") continue;
    const product = d.relatedProductId ? await ctx.db.get(d.relatedProductId) : undefined;
    const touched =
      (product && result.productShortages.some((s) => s.productId === product._id)) ||
      (d.relatedOrderId && result.allocations.some((a) => a.orderId === d.relatedOrderId)) ||
      result.backorders.some((b) => product && b.productId === product._id);
    if (!touched) continue;
    await ctx.db.patch(d._id, { status: "Applied", resolvedAt: now });
    appliedDecisionIds.push(d._id);
    await resolveExceptionForDecision(ctx, d._id, now, "Priority-based allocation applied; stock rebalanced.");
  }

  await log(ctx, "info", `Smart allocation run — ${result.allocations.length} allocations, ${result.holds.length} held, ${result.unfulfilled} units unfulfilled.`);
  if (result.unfulfilled > 0) {
    await notify(ctx, "warning", `Allocation run complete: ${result.unfulfilled} units of demand remain unfulfilled.`);
  } else {
    await notify(ctx, "success", "Allocation run complete — all demand fulfilled.");
  }

  return { ...result, appliedDecisionIds };
}

/* ---------------- smart allocation ---------------- */

export const runAllocation = mutation({
  args: {},
  handler: async (ctx) => performAllocation(ctx),
});

/* ---------------- decisions ---------------- */

export const applyDecision = mutation({
  args: { decisionId: v.id("decisions") },
  handler: async (ctx, { decisionId }) => {
    const now = Date.now();
    const decision = await ctx.db.get(decisionId);
    if (!decision) throw new Error("Decision not found");
    if (decision.status !== "Pending") return { ok: false, message: "Decision is no longer pending." };

    switch (decision.type) {
      case "allocation": {
        const result = await performAllocation(ctx);
        return { ok: true, message: `Allocation applied — ${result.unfulfilled} units remain unfulfilled.` };
      }
      case "reorder": {
        if (!decision.relatedProductId) throw new Error("Missing product");
        const qty = decision.payload?.quantity ?? 40;
        const existing = (await ctx.db.query("reorders").collect()).find(
          (r) => r.productId === decision.relatedProductId && r.status === "Pending",
        );
        if (existing) await ctx.db.patch(existing._id, { status: "Created" });
        else {
          await ctx.db.insert("reorders", {
            productId: decision.relatedProductId,
            quantity: qty,
            reason: decision.analysis,
            status: "Created",
            createdAt: now,
          });
        }
        const inv = await ctx.db.query("inventory").withIndex("by_product", (q) => q.eq("productId", decision.relatedProductId!)).first();
        if (inv) await ctx.db.patch(inv._id, { incoming: inv.incoming + qty });
        const product = await ctx.db.get(decision.relatedProductId);
        await log(ctx, "success", `Purchase order created for ${qty} units of ${product?.sku ?? "SKU"}.`);
        await notify(ctx, "success", `Reorder created: ${qty} units of ${product?.sku ?? "SKU"}`);
        break;
      }
      case "bottleneck": {
        const pickers = (await ctx.db.query("workers").collect()).filter((w) => w.role === "Picker" && w.zone === "C");
        let moved = 0;
        for (const w of pickers.slice(0, 2)) {
          await ctx.db.patch(w._id, { zone: "B" });
          moved++;
        }
        const bottlenecks = await ctx.db.query("bottlenecks").collect();
        for (const b of bottlenecks) {
          if (b.status === "Active") await ctx.db.patch(b._id, { status: "Resolved" });
        }
        await log(ctx, "success", `Reassigned ${moved} worker${moved === 1 ? "" : "s"} from Zone C to Zone B — bottleneck cleared.`);
        await notify(ctx, "success", "Picking bottleneck resolved — 2 workers moved to Zone B.");
        break;
      }
      case "damage": {
        await resolveExceptionForDecision(ctx, decision._id, now, "Item replaced from Zone C stock; damaged unit sent to QA.");
        const product = decision.relatedProductId ? await ctx.db.get(decision.relatedProductId) : undefined;
        await log(ctx, "info", `Damaged ${product?.sku ?? "item"} replaced — exception resolved.`);
        await notify(ctx, "info", "Damaged item replaced — exception resolved.");
        break;
      }
      case "dispatch": {
        if (!decision.relatedOrderId) throw new Error("Missing order");
        await dispatchOrderInternal(ctx, decision.relatedOrderId);
        break;
      }
      case "qc": {
        const taskId = decision.payload?.qcTaskId as Id<"qcTasks"> | undefined;
        if (taskId) await qcPassInternal(ctx, taskId);
        break;
      }
      case "packing": {
        await resolveExceptionForDecision(ctx, decision._id, now, "Packing error corrected; order returned to packing queue.");
        if (decision.relatedOrderId) {
          const order = await ctx.db.get(decision.relatedOrderId);
          if (order && order.status === "Exception") {
            await ctx.db.patch(order._id, { status: "Packing", hasException: false });
          }
        }
        await log(ctx, "success", "Packing error resolved — order returned to packing queue.");
        break;
      }
      default:
        throw new Error(`Unhandled decision type: ${decision.type}`);
    }

    await ctx.db.patch(decision._id, { status: "Applied", resolvedAt: now });
    return { ok: true, message: `Decision ${decision.decisionId} applied.` };
  },
});

export const overrideDecision = mutation({
  args: { decisionId: v.id("decisions") },
  handler: async (ctx, { decisionId }) => {
    const decision = await ctx.db.get(decisionId);
    if (!decision) throw new Error("Decision not found");
    await ctx.db.patch(decision._id, { status: "Overridden", resolvedAt: Date.now() });
    await log(ctx, "warning", `Decision ${decision.decisionId} overridden by operator — ${decision.recommendation}`);
    await notify(ctx, "info", `Decision ${decision.decisionId} overridden by operator.`);
    return { ok: true, message: `Decision ${decision.decisionId} overridden.` };
  },
});

export const ignoreDecision = mutation({
  args: { decisionId: v.id("decisions") },
  handler: async (ctx, { decisionId }) => {
    const decision = await ctx.db.get(decisionId);
    if (!decision) throw new Error("Decision not found");
    await ctx.db.patch(decision._id, { status: "Ignored", resolvedAt: Date.now() });
    await log(ctx, "info", `Decision ${decision.decisionId} ignored.`);
    return { ok: true };
  },
});

/* ---------------- dispatch ---------------- */

async function dispatchOrderInternal(ctx: MutationCtx, orderId: Id<"orders">) {
  const now = Date.now();
  const order = await ctx.db.get(orderId);
  if (!order) throw new Error("Order not found");
  if (order.status === "Dispatched" || order.status === "Completed") return;

  // reduce reserved inventory
  for (const item of order.items) {
    if (item.allocated <= 0) continue;
    const inv = await ctx.db.query("inventory").withIndex("by_product", (q) => q.eq("productId", item.productId)).first();
    if (inv) {
      await ctx.db.patch(inv._id, {
        reserved: Math.max(0, inv.reserved - item.allocated),
      });
    }
  }

  const items = order.items.map((i) => ({ ...i, fulfilled: i.allocated }));
  const timeline = order.timeline.map((t) => {
    if (t.key === "dispatch" || t.key === "completed") {
      return { ...t, state: "done" as const, at: now };
    }
    return t;
  });

  await ctx.db.patch(order._id, {
    items,
    status: "Dispatched",
    inventoryStatus: "Available",
    timeline,
    completedAt: now,
    delayed: false,
  });

  const records = await ctx.db.query("dispatchRecords").collect();
  const rec = records.find((r) => r.orderId === orderId && r.status !== "Dispatched");
  if (rec) await ctx.db.patch(rec._id, { status: "Dispatched", dispatchedAt: now });

  // update today's metrics
  const metrics = await ctx.db.query("metrics").collect();
  const today = metrics.find((m) => m.day === 0) ?? metrics.sort((a, b) => a.day - b.day)[0];
  if (today) {
    await ctx.db.patch(today._id, { fulfilled: today.fulfilled + 1, orders: today.orders + 1 });
  }

  await log(ctx, "success", `Order ${order.orderNumber} dispatched — fulfillment confirmed.`, order.orderNumber);
  await notify(ctx, "success", `Order ${order.orderNumber} dispatched.`);
}

export const dispatchOrder = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    await dispatchOrderInternal(ctx, orderId);
    return { ok: true };
  },
});

export const delayOrder = mutation({
  args: { orderId: v.id("orders"), reason: v.string() },
  handler: async (ctx, { orderId, reason }) => {
    const now = Date.now();
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    await ctx.db.patch(order._id, { status: "Delayed", delayed: true });

    const records = await ctx.db.query("dispatchRecords").collect();
    const rec = records.find((r) => r.orderId === orderId);
    if (rec) await ctx.db.patch(rec._id, { status: "Delayed" });

    const exId = await nextNumber(ctx, "exceptions", "EX-");
    const exception = await ctx.db.insert("exceptions", {
      exceptionId: exId,
      type: "Dispatch delay",
      severity: "High",
      orderId: order._id,
      description: reason || `Dispatch deadline missed for ${order.orderNumber}.`,
      impact: `${order.orderNumber} delivery SLA at risk.`,
      aiRecommendation: "Dispatch with the next carrier slot or offer the customer self-pickup to protect the SLA.",
      status: "Open",
      decisionHistory: [
        { stage: "Detected", at: now },
        { stage: "Analyzed", at: now },
        { stage: "Recommended", at: now },
      ],
      createdAt: now,
    });
    const dId = await nextNumber(ctx, "decisions", "AI-");
    await ctx.db.insert("decisions", {
      decisionId: dId,
      type: "dispatch",
      problem: `Dispatch delay — ${order.orderNumber}`,
      analysis: `Order missed its dispatch window. Carrier cut-off passed with the order still at the dock.`,
      recommendation: "Dispatch with the next carrier slot or offer the customer self-pickup.",
      expectedImpact: ["Delivery SLA protected", "Customer notified proactively"],
      relatedOrderId: order._id,
      relatedExceptionId: exception,
      status: "Pending",
      createdAt: now,
    });
    await log(ctx, "warning", `Order ${order.orderNumber} delayed — ${reason || "dispatch window missed"}`, order.orderNumber);
    await notify(ctx, "warning", `Order ${order.orderNumber} delayed: ${reason || "dispatch window missed"}`);
    return { ok: true };
  },
});

/* ---------------- damage ---------------- */

export const markDamaged = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
    orderNumber: v.optional(v.string()),
    description: v.string(),
  },
  handler: async (ctx, { productId, quantity, orderNumber, description }) => {
    const now = Date.now();
    const product = await ctx.db.get(productId);
    if (!product) throw new Error("Product not found");
    const inv = await ctx.db.query("inventory").withIndex("by_product", (q) => q.eq("productId", productId)).first();
    if (!inv) throw new Error("Inventory record not found");
    const toDamage = Math.min(quantity, inv.available);
    await ctx.db.patch(inv._id, {
      available: Math.max(0, inv.available - toDamage),
      damaged: inv.damaged + toDamage,
    });

    const order = orderNumber
      ? (await ctx.db.query("orders").collect()).find((o) => o.orderNumber === orderNumber)
      : undefined;
    const exId = await nextNumber(ctx, "exceptions", "EX-");
    const exception = await ctx.db.insert("exceptions", {
      exceptionId: exId,
      type: "Damaged item",
      severity: "High",
      orderId: order?._id,
      productId,
      sku: product.sku,
      quantity: toDamage,
      description: description || `${toDamage} unit(s) of ${product.name} reported damaged.`,
      impact: order ? `Order ${order.orderNumber} waiting for replacement.` : `${product.sku} stock reduced by ${toDamage}.`,
      aiRecommendation: `Replace item using available inventory from another zone and return damaged unit(s) to QA.`,
      status: "Open",
      decisionHistory: [
        { stage: "Detected", at: now },
        { stage: "Analyzed", at: now },
        { stage: "Recommended", at: now },
      ],
      createdAt: now,
    });
    const dId = await nextNumber(ctx, "decisions", "AI-");
    const decision = await ctx.db.insert("decisions", {
      decisionId: dId,
      type: "damage",
      problem: `Damaged item — ${product.sku}`,
      analysis: `${toDamage} unit(s) of ${product.name} reported damaged${order ? ` on ${order.orderNumber}` : ""}. Replacement required before dispatch.`,
      recommendation: "Replace item using available inventory from another zone and flag the damaged unit for QA.",
      expectedImpact: [order ? `Order ${order.orderNumber} dispatch delayed by ~20 min` : "Inventory accuracy maintained", "Damaged unit quarantined"],
      relatedOrderId: order?._id,
      relatedProductId: productId,
      relatedExceptionId: exception,
      status: "Pending",
      createdAt: now,
    });
    void decision;
    await log(ctx, "error", `Damaged item reported — ${product.sku} (${toDamage} unit${toDamage === 1 ? "" : "s"})${order ? `, ${order.orderNumber}` : ""}`);
    await notify(ctx, "critical", `Damaged item detected: ${product.sku} (${toDamage} unit${toDamage === 1 ? "" : "s"})`);
    return { ok: true, exceptionId: exId, decisionId: dId };
  },
});

/* ---------------- picking ---------------- */

export const startPicking = mutation({
  args: { taskId: v.id("pickingTasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(task._id, { status: "In Progress", startedAt: Date.now() });
    return { ok: true };
  },
});

export const completePicking = mutation({
  args: { taskId: v.id("pickingTasks") },
  handler: async (ctx, { taskId }) => {
    const now = Date.now();
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(task._id, { status: "Completed", completedAt: now });

    const order = await ctx.db.get(task.orderId);
    if (order) {
      const timeline = order.timeline.map((t) => (t.key === "picking" ? { ...t, state: "done" as const, at: now } : t));
      await ctx.db.patch(order._id, { status: "Packing", timeline });
      const packers = (await ctx.db.query("workers").collect()).filter((w) => w.role === "Packer");
      const worker = packers.find((w) => w.zone === "Packing") ?? packers[0];
      if (worker) {
        const taskId = await nextTaskId(ctx, "packingTasks", "taskId", "PK-");
        await ctx.db.insert("packingTasks", {
          taskId,
          orderId: order._id,
          station: "Packing Station 1",
          workerId: worker._id,
          status: "Pending",
        });
      }
    }
    await log(ctx, "success", `Picking task ${task.taskId} completed — order moved to packing.`);
    return { ok: true };
  },
});

export const failPicking = mutation({
  args: { taskId: v.id("pickingTasks"), note: v.string() },
  handler: async (ctx, { taskId, note }) => {
    const now = Date.now();
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(task._id, { status: "Failed" });
    const order = task.orderId ? await ctx.db.get(task.orderId) : undefined;
    if (order) {
      await ctx.db.patch(order._id, { status: "Exception", hasException: true });
    }
    const exId = await nextNumber(ctx, "exceptions", "EX-");
    const exception = await ctx.db.insert("exceptions", {
      exceptionId: exId,
      type: "Picking failure",
      severity: "Medium",
      orderId: order?._id,
      description: note || `Picking task ${task.taskId} failed.`,
      impact: order ? `Order ${order.orderNumber} blocked in picking.` : "Task requires reassignment.",
      aiRecommendation: "Reassign the task to an available picker with the shortest queue.",
      status: "Open",
      decisionHistory: [
        { stage: "Detected", at: now },
        { stage: "Analyzed", at: now },
        { stage: "Recommended", at: now },
      ],
      createdAt: now,
    });
    const dId = await nextNumber(ctx, "decisions", "AI-");
    await ctx.db.insert("decisions", {
      decisionId: dId,
      type: "picking",
      problem: `Picking failure — ${task.taskId}`,
      analysis: note || `Task ${task.taskId} could not be completed by the assigned picker.`,
      recommendation: "Reassign the task to an available picker with the shortest queue.",
      expectedImpact: ["Queue recovers within 25 minutes", "Order SLA protected"],
      relatedOrderId: order?._id,
      relatedExceptionId: exception,
      status: "Pending",
      createdAt: now,
    });        await log(ctx, "error", `Picking failure on ${task.taskId}${order ? ` (${order.orderNumber})` : ""}.`);
        await notify(ctx, "warning", `Picking failure: ${task.taskId}${order ? ` (${order.orderNumber})` : ""}`);
    return { ok: true };
  },
});

/* ---------------- packing ---------------- */

export const startPacking = mutation({
  args: { taskId: v.id("packingTasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(task._id, { status: "In Progress", startedAt: Date.now() });
    return { ok: true };
  },
});

export const completePacking = mutation({
  args: { taskId: v.id("packingTasks") },
  handler: async (ctx, { taskId }) => {
    const now = Date.now();
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(task._id, { status: "Completed", completedAt: now });

    const order = await ctx.db.get(task.orderId);
    if (order) {
      const timeline = order.timeline.map((t) => (t.key === "packing" ? { ...t, state: "done" as const, at: now } : t));
      await ctx.db.patch(order._id, { status: "Quality Check", timeline });
      const inspectors = (await ctx.db.query("workers").collect()).filter((w) => w.role === "QC Inspector");
      const taskId = await nextTaskId(ctx, "qcTasks", "taskId", "QC-");
      await ctx.db.insert("qcTasks", {
        taskId,
        orderId: order._id,
        status: "Pending",
        inspectorId: inspectors[0]?._id,
      });
    }
    await log(ctx, "success", `Packing task ${task.taskId} completed — order moved to quality check.`);
    return { ok: true };
  },
});

export const reportPackingIssue = mutation({
  args: { taskId: v.id("packingTasks"), description: v.string() },
  handler: async (ctx, { taskId, description }) => {
    const now = Date.now();
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(task._id, { status: "Failed", note: description });

    const order = task.orderId ? await ctx.db.get(task.orderId) : undefined;
    if (order) await ctx.db.patch(order._id, { status: "Exception", hasException: true });

    const exId = await nextNumber(ctx, "exceptions", "EX-");
    const exception = await ctx.db.insert("exceptions", {
      exceptionId: exId,
      type: "Packing error",
      severity: "Medium",
      orderId: order?._id,
      description: description || `Packing issue on task ${task.taskId}.`,
      impact: order ? `Order ${order.orderNumber} moved to exception queue.` : "Packing task requires rework.",
      aiRecommendation: "Re-pack the order using the correct box and materials, then re-run quality checks.",
      status: "Open",
      decisionHistory: [
        { stage: "Detected", at: now },
        { stage: "Analyzed", at: now },
        { stage: "Recommended", at: now },
      ],
      createdAt: now,
    });
    const dId = await nextNumber(ctx, "decisions", "AI-");
    await ctx.db.insert("decisions", {
      decisionId: dId,
      type: "packing",
      problem: `Packing error — ${task.taskId}`,
      analysis: description || `Packing issue reported on ${task.taskId}.`,
      recommendation: "Re-pack the order and re-run quality checks.",
      expectedImpact: ["Order returns to packing queue", "No inventory impact"],
      relatedOrderId: order?._id,
      relatedExceptionId: exception,
      status: "Pending",
      createdAt: now,
    });
    await log(ctx, "error", `Packing issue on ${task.taskId}${order ? ` (${order.orderNumber})` : ""}.`);
    await notify(ctx, "warning", `Packing error: ${task.taskId}${order ? ` (${order.orderNumber})` : ""}`);
    return { ok: true };
  },
});

/* ---------------- quality control ---------------- */

async function qcPassInternal(ctx: MutationCtx, taskId: Id<"qcTasks">) {
  const now = Date.now();
  const task = await ctx.db.get(taskId);
  if (!task) throw new Error("Task not found");
  const inspectors = (await ctx.db.query("workers").collect()).filter((w) => w.role === "QC Inspector");
  await ctx.db.patch(task._id, { status: "Passed", inspectorId: inspectors[0]?._id, inspectedAt: now });

  const order = await ctx.db.get(task.orderId);
  if (order) {
    const timeline = order.timeline.map((t) => (t.key === "qc" ? { ...t, state: "done" as const, at: now } : t));
    await ctx.db.patch(order._id, { status: "Ready to Dispatch", timeline });
    const customer = order.customerId ? await ctx.db.get(order.customerId) : undefined;
    const carriers = ["BlueDart", "Delhivery", "DTDC", "Ekart"];
    const dispatchId = await nextTaskId(ctx, "dispatchRecords", "dispatchId", "DS-");
    await ctx.db.insert("dispatchRecords", {
      dispatchId,
      orderId: order._id,
      carrier: carriers[order.orderNumber.length % carriers.length],
      packageWeight: `${(0.5 + (order.value % 18) / 10).toFixed(1)} kg`,
      destination: customer?.city ?? "Bengaluru",
      deadline: order.deadline,
      status: "Ready",
    });
  }
  await log(ctx, "success", `Order ${order?.orderNumber ?? ""} passed quality check.`);
}

export const qcPass = mutation({
  args: { taskId: v.id("qcTasks") },
  handler: async (ctx, { taskId }) => {
    await qcPassInternal(ctx, taskId);
    return { ok: true };
  },
});

export const qcFail = mutation({
  args: { taskId: v.id("qcTasks"), note: v.string() },
  handler: async (ctx, { taskId, note }) => {
    const now = Date.now();
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(task._id, { status: "Failed", note, inspectedAt: now });

    const order = task.orderId ? await ctx.db.get(task.orderId) : undefined;
    if (order) await ctx.db.patch(order._id, { status: "Exception", hasException: true });

    const exId = await nextNumber(ctx, "exceptions", "EX-");
    const exception = await ctx.db.insert("exceptions", {
      exceptionId: exId,
      type: "QC failure",
      severity: "High",
      orderId: order?._id,
      description: note || "Item failed quality inspection.",
      impact: order ? `Order ${order.orderNumber} blocked pending re-inspection.` : "Quarantined stock pending review.",
      aiRecommendation: "Quarantine the item, re-pick from healthy stock and re-run QC before dispatch.",
      status: "Open",
      decisionHistory: [
        { stage: "Detected", at: now },
        { stage: "Analyzed", at: now },
        { stage: "Recommended", at: now },
      ],
      createdAt: now,
    });
    const dId = await nextNumber(ctx, "decisions", "AI-");
    await ctx.db.insert("decisions", {
      decisionId: dId,
      type: "qc",
      problem: `QC failure — ${task.taskId}`,
      analysis: note || "Item failed quality inspection.",
      recommendation: "Quarantine the item, re-pick from healthy stock and re-run QC.",
      expectedImpact: ["Dispatch delayed by ~30 minutes", "Defective unit quarantined"],
      relatedOrderId: order?._id,
      relatedExceptionId: exception,
      payload: { qcTaskId: taskId },
      status: "Pending",
      createdAt: now,
    });
    await log(ctx, "error", `QC failure on ${task.taskId}${order ? ` (${order.orderNumber})` : ""}.`);
    await notify(ctx, "critical", `QC failure: ${task.taskId}${order ? ` (${order.orderNumber})` : ""}`);
    return { ok: true };
  },
});

/* ---------------- exceptions + reorders ---------------- */

export const resolveException = mutation({
  args: { exceptionId: v.id("exceptions"), resolution: v.string() },
  handler: async (ctx, { exceptionId, resolution }) => {
    const now = Date.now();
    const ex = await ctx.db.get(exceptionId);
    if (!ex) throw new Error("Exception not found");
    await ctx.db.patch(ex._id, {
      status: "Resolved",
      resolvedAt: now,
      resolution,
      decisionHistory: [...ex.decisionHistory, { stage: "Resolved", at: now }],
    });
    const order = ex.orderId ? await ctx.db.get(ex.orderId) : undefined;
    if (order) {
      const stillOpen = (await ctx.db.query("exceptions").collect()).some(
        (e) => e.orderId === order._id && e.status === "Open",
      );
      if (!stillOpen) await ctx.db.patch(order._id, { hasException: false });
    }
    await log(ctx, "info", `Exception ${ex.exceptionId} resolved — ${resolution}`);
    return { ok: true };
  },
});

export const createReorder = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx, { productId, quantity }) => {
    const now = Date.now();
    const product = await ctx.db.get(productId);
    if (!product) throw new Error("Product not found");
    const existing = (await ctx.db.query("reorders").collect()).find(
      (r) => r.productId === productId && r.status === "Pending",
    );
    if (existing) {
      await ctx.db.patch(existing._id, { status: "Created" });
    } else {
      await ctx.db.insert("reorders", {
        productId,
        quantity,
        reason: `Manual reorder — ${quantity} units of ${product.sku}.`,
        status: "Created",
        createdAt: now,
      });
    }
    const inv = await ctx.db.query("inventory").withIndex("by_product", (q) => q.eq("productId", productId)).first();
    if (inv) await ctx.db.patch(inv._id, { incoming: inv.incoming + quantity });
    await log(ctx, "success", `Purchase order created for ${quantity} units of ${product.sku}.`);
    await notify(ctx, "success", `Reorder created: ${quantity} units of ${product.sku}`);
    return { ok: true };
  },
});

export const ignoreReorder = mutation({
  args: { reorderId: v.id("reorders") },
  handler: async (ctx, { reorderId }) => {
    const reorder = await ctx.db.get(reorderId);
    if (!reorder) throw new Error("Reorder not found");
    await ctx.db.patch(reorder._id, { status: "Ignored" });
    await log(ctx, "info", `Reorder for ${reorder.quantity} units ignored by operator.`);
    return { ok: true };
  },
});

/* ---------------- notifications ---------------- */

export const markNotificationRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const n = await ctx.db.get(id);
    if (n) await ctx.db.patch(n._id, { read: true });
    return { ok: true };
  },
});

export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("notifications").collect();
    for (const n of all) {
      if (!n.read) await ctx.db.patch(n._id, { read: true });
    }
    return { ok: true };
  },
});

export const clearNotifications = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("notifications").collect();
    for (const n of all) await ctx.db.delete(n._id);
    return { ok: true };
  },
});

/* ---------------- demo scenarios ---------------- */

export const runDemoScenario = mutation({
  args: { scenario: v.number() },
  handler: async (ctx, { scenario }) => {
    const now = Date.now();
    const customers = await ctx.db.query("customers").collect();
    const products = await ctx.db.query("products").collect();
    const bySku = (sku: string) => products.find((p) => p.sku === sku);
    const custByName = (name: string) => customers.find((c) => c.name === name);

    const makeOrder = async (num: string, customerName: string, skus: [string, number][], deadlineHrs: number, createdMinAgo: number) => {
      const customer = custByName(customerName);
      const items = skus.map(([sku, qty]) => ({ productId: bySku(sku)!._id, qty, allocated: 0, fulfilled: 0 }));
      const value = skus.reduce((s, [sku, qty]) => s + bySku(sku)!.price * qty, 0);
      const createdAt = now - createdMinAgo * MIN;
      const deadline = now + deadlineHrs * HOUR;
      const tier = customer?.tier ?? "Standard";
      const prio = calculatePriorityFor({ tier, deadline, createdAt, value, invStatus: "Shortage" });
      const timeline = [
        { key: "created", label: "Order Created", state: "done" as const, at: createdAt },
        { key: "priority", label: "Priority Determined", state: "done" as const, at: createdAt + MIN },
        { key: "inventory", label: "Inventory Checked", state: "done" as const, at: createdAt + 2 * MIN, note: "Shortage detected" },
        { key: "allocation", label: "Allocation", state: "partial" as const, at: createdAt + 3 * MIN, note: "Insufficient stock — allocation pending" },
        { key: "picking", label: "Picking", state: "pending" as const, at: 0 },
        { key: "packing", label: "Packing", state: "pending" as const, at: 0 },
        { key: "qc", label: "Quality Check", state: "pending" as const, at: 0 },
        { key: "dispatch", label: "Dispatch", state: "pending" as const, at: 0 },
        { key: "completed", label: "Completed", state: "pending" as const, at: 0 },
      ];
      const id = await ctx.db.insert("orders", {
        orderNumber: num,
        customerId: customer?._id ?? (customers[0]?._id ?? ("" as never)),
        items,
        value,
        priorityScore: prio.score,
        priorityLevel: prio.level,
        priorityReasons: prio.reasons,
        deadline,
        createdAt,
        status: "Pending",
        inventoryStatus: "Shortage",
        timeline,
        delayed: false,
        hasException: false,
      });
      return { id, level: prio.level };
    };

    switch (scenario) {
      case 1: {
        // Inventory shortage — fresh conflict on WH-204
        const wh = bySku("WH-204")!;
        const inv = await ctx.db.query("inventory").withIndex("by_product", (q) => q.eq("productId", wh._id)).first();
        if (inv && inv.available > 3) await ctx.db.patch(inv._id, { available: 3 });
        const order = await makeOrder("ORD-1051", "Aarti Mehta", [["WH-204", 10]], 1.5, 6);
        const exId = await nextNumber(ctx, "exceptions", "EX-");
        await ctx.db.insert("exceptions", {
          exceptionId: exId,
          type: "Stock shortage",
          severity: "Critical",
          orderId: order.id,
          productId: wh._id,
          sku: wh.sku,
          quantity: 10,
          description: "Demo scenario 1 — fresh shortage: only 3 units of WH-204 available for a 10-unit critical order.",
          impact: "Critical order at stockout risk within hours.",
          aiRecommendation: `Allocate all 3 available units to ORD-1051 (${order.level}), hold competing orders, backorder the rest and create a replenishment request.`,
          status: "Open",
          decisionHistory: [
            { stage: "Detected", at: now },
            { stage: "Analyzed", at: now },
            { stage: "Recommended", at: now },
          ],
          createdAt: now,
        });
        const dId = await nextNumber(ctx, "decisions", "AI-");
        await ctx.db.insert("decisions", {
          decisionId: dId,
          type: "allocation",
          problem: `Inventory conflict — ${wh.sku} (Scenario 1)`,
          analysis: `ORD-1051 (${order.level}) requires 10 units; only 3 are available.`,
          recommendation: "Allocate all 3 available units to ORD-1051, backorder 7 and create a replenishment request.",
          expectedImpact: ["Critical order partially fulfilled", "Replenishment request created", "Stockout prevented for highest-priority demand"],
          relatedOrderId: order.id,
          relatedProductId: wh._id,
          status: "Pending",
          createdAt: now,
        });
        await log(ctx, "error", "Demo scenario 1 loaded — fresh WH-204 shortage vs ORD-1051.");
        await notify(ctx, "critical", "Demo: inventory shortage created — ORD-1051 needs 10 WH-204, only 3 available.");
        return { ok: true, message: "Scenario 1 loaded: inventory shortage (ORD-1051 needs 10 WH-204, 3 available)." };
      }
      case 2: {
        const order = await makeOrder("ORD-1052", "Karan Malhotra", [["WH-510", 1], ["CH-45", 2]], 1, 4);
        const dId = await nextNumber(ctx, "decisions", "AI-");
        await ctx.db.insert("decisions", {
          decisionId: dId,
          type: "allocation",
          problem: "Critical order detected — ORD-1052",
          analysis: "Platinum customer, 1-hour dispatch deadline, high order value. Priority score exceeds 90.",
          recommendation: "Process ORD-1052 first across picking, packing and QC queues.",
          expectedImpact: ["Order dispatched within the hour", "Customer SLA protected"],
          relatedOrderId: order.id,
          status: "Pending",
          createdAt: now,
        });
        await log(ctx, "warning", "Demo scenario 2 loaded — new Critical order ORD-1052.");
        await notify(ctx, "warning", "Demo: critical order ORD-1052 created (1-hour deadline).");
        return { ok: true, message: "Scenario 2 loaded: critical order ORD-1052 with 1-hour deadline." };
      }
      case 3: {
        const kb = bySku("KB-102")!;
        await ctx.db.insert("activityLog", { type: "info", message: "Demo scenario 3 — damage simulation started.", at: now });
        const res = await markDamagedInternal(ctx, kb._id, 2, undefined, "Demo scenario 3 — two keyboards damaged during unloading.");
        await log(ctx, "error", "Demo scenario 3 loaded — damaged item KB-102.");
        await notify(ctx, "critical", "Demo: damaged item reported — KB-102 (2 units).");
        return { ok: true, message: `Scenario 3 loaded: damaged item — ${res.decisionId} created.` };
      }
      case 4: {
        await ctx.db.insert("bottlenecks", {
          bottleneckId: "BN-3",
          area: "Picking",
          zone: "C",
          avgTime: 16.1,
          normal: 9.5,
          pctIncrease: 69,
          recommendation: "Reassign 2 workers from Zone A to Zone C.",
          status: "Active",
          createdAt: now,
        });
        const dId = await nextNumber(ctx, "decisions", "AI-");
        await ctx.db.insert("decisions", {
          decisionId: dId,
          type: "bottleneck",
          problem: "Picking bottleneck — Zone C (Scenario 4)",
          analysis: "Average pick time in Zone C reached 16.1 min vs a 9.5 min baseline (+69%).",
          recommendation: "Reassign 2 workers from Zone A to Zone C.",
          expectedImpact: ["Picking time reduction: 20–25%", "Zone C queue clears in ~35 minutes"],
          status: "Pending",
          createdAt: now,
        });
        await log(ctx, "warning", "Demo scenario 4 loaded — picking bottleneck in Zone C.");
        await notify(ctx, "warning", "Demo: bottleneck detected in Zone C (+69% pick time).");
        return { ok: true, message: "Scenario 4 loaded: picking bottleneck in Zone C." };
      }
      case 5: {
        const ready = (await ctx.db.query("orders").collect()).find((o) => o.status === "Ready to Dispatch");
        if (!ready) {
          await log(ctx, "warning", "Demo scenario 5 — no ready order found.");
          return { ok: false, message: "No order in 'Ready to Dispatch' to delay." };
        }
        const res = await delayOrderInternal(ctx, ready._id, "Demo scenario 5 — carrier cut-off missed.");
        await log(ctx, "warning", "Demo scenario 5 loaded — dispatch delay on " + ready.orderNumber + ".");
        await notify(ctx, "warning", "Demo: dispatch delay on " + ready.orderNumber);
        return { ok: true, message: `Scenario 5 loaded: ${ready.orderNumber} delayed.` };
      }
      default:
        return { ok: false, message: "Unknown scenario." };
    }
  },
});

/* small internal wrappers used by demo scenarios to avoid double-logging */
async function markDamagedInternal(ctx: MutationCtx, productId: Id<"products">, quantity: number, orderNumber: string | undefined, description: string) {
  const now = Date.now();
  const product = await ctx.db.get(productId);
  const inv = await ctx.db.query("inventory").withIndex("by_product", (q) => q.eq("productId", productId)).first();
  if (!inv) throw new Error("Inventory not found");
  const toDamage = Math.min(quantity, inv.available);
  await ctx.db.patch(inv._id, { available: Math.max(0, inv.available - toDamage), damaged: inv.damaged + toDamage });
  const order = orderNumber ? (await ctx.db.query("orders").collect()).find((o) => o.orderNumber === orderNumber) : undefined;
  const exId = await nextNumber(ctx, "exceptions", "EX-");
  const exception = await ctx.db.insert("exceptions", {
    exceptionId: exId,
    type: "Damaged item",
    severity: "High",
    orderId: order?._id,
    productId,
    sku: product?.sku,
    quantity: toDamage,
    description: description || `${toDamage} unit(s) of ${product?.name} reported damaged.`,
    impact: order ? `Order ${order.orderNumber} waiting for replacement.` : `${product?.sku} stock reduced by ${toDamage}.`,
    aiRecommendation: "Replace item using available inventory from another zone and return damaged unit(s) to QA.",
    status: "Open",
    decisionHistory: [
      { stage: "Detected", at: now },
      { stage: "Analyzed", at: now },
      { stage: "Recommended", at: now },
    ],
    createdAt: now,
  });
  const dId = await nextNumber(ctx, "decisions", "AI-");
  const decision = await ctx.db.insert("decisions", {
    decisionId: dId,
    type: "damage",
    problem: `Damaged item — ${product?.sku}`,
    analysis: `${toDamage} unit(s) of ${product?.name} reported damaged.`,
    recommendation: "Replace item using available inventory from another zone and flag the damaged unit for QA.",
    expectedImpact: [order ? `Order ${order.orderNumber} dispatch delayed by ~20 min` : "Inventory accuracy maintained", "Damaged unit quarantined"],
    relatedOrderId: order?._id,
    relatedProductId: productId,
    relatedExceptionId: exception,
    status: "Pending",
    createdAt: now,
  });
  return { exceptionId: exId, decisionId: dId, decision };
}

async function delayOrderInternal(ctx: MutationCtx, orderId: Id<"orders">, reason: string) {
  const now = Date.now();
  const order = await ctx.db.get(orderId);
  if (!order) throw new Error("Order not found");
  await ctx.db.patch(order._id, { status: "Delayed", delayed: true });
  const records = await ctx.db.query("dispatchRecords").collect();
  const rec = records.find((r) => r.orderId === orderId);
  if (rec) await ctx.db.patch(rec._id, { status: "Delayed" });
  const exId = await nextNumber(ctx, "exceptions", "EX-");
  await ctx.db.insert("exceptions", {
    exceptionId: exId,
    type: "Dispatch delay",
    severity: "High",
    orderId: order._id,
    description: reason || `Dispatch deadline missed for ${order.orderNumber}.`,
    impact: `${order.orderNumber} delivery SLA at risk.`,
    aiRecommendation: "Dispatch with the next carrier slot or offer the customer self-pickup.",
    status: "Open",
    decisionHistory: [
      { stage: "Detected", at: now },
      { stage: "Analyzed", at: now },
      { stage: "Recommended", at: now },
    ],
    createdAt: now,
  });
  return { ok: true };
}

/* priority helper for demo scenario orders */
function calculatePriorityFor(input: { tier: string; deadline: number; createdAt: number; value: number; invStatus: string }) {
  const now = Date.now();
  const tierPts: Record<string, number> = { Platinum: 30, Premium: 24, Standard: 18, Basic: 12 };
  const reasons: string[] = [`+${tierPts[input.tier] ?? 12} ${input.tier} customer`];
  const hoursLeft = (input.deadline - now) / HOUR;
  const urgency = hoursLeft <= 2 ? 25 : hoursLeft <= 6 ? 18 : hoursLeft <= 12 ? 10 : 6;
  reasons.push(`+${urgency} ${hoursLeft <= 0 ? "Deadline passed" : `Deadline in ${Math.round(hoursLeft)}h`}`);
  const minutes = Math.max(0, (now - input.createdAt) / MIN);
  const age = Math.min(15, Math.floor(minutes / 6) * 3);
  if (age > 0) reasons.push(`+${age} Order waiting for ${Math.floor(minutes)} min`);
  const valuePts = Math.min(15, Math.floor(input.value / 700));
  reasons.push(`+${valuePts} High-value order`);
  reasons.push("+10 Inventory conflict");
  const score = Math.min(100, reasons.reduce((s, r) => s + parseInt(r.split("+")[1], 10), 0));
  const level: "Critical" | "High" | "Medium" | "Low" =
    score >= 80 ? "Critical" : score >= 60 ? "High" : score >= 40 ? "Medium" : "Low";
  return { score, level, reasons };
}
