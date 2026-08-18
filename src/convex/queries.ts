import { v } from "convex/values";
import { query } from "./_generated/server";
import { calculateWarehouseEfficiency } from "./decisionEngine";

const IN_FLIGHT = ["Pending", "Picking", "Packing", "Quality Check", "Ready to Dispatch", "Delayed", "Exception"];

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/* ---------------- dashboard / command center ---------------- */

export const getDashboard = query({
  args: {},
  handler: async (ctx) => {
    const [orders, metrics, activity, decisions, bottlenecks, products, inventory, exceptions] = await Promise.all([
      ctx.db.query("orders").collect(),
      ctx.db.query("metrics").collect(),
      ctx.db.query("activityLog").collect(),
      ctx.db.query("decisions").collect(),
      ctx.db.query("bottlenecks").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("inventory").collect(),
      ctx.db.query("exceptions").collect(),
    ]);

    const totalOrders = metrics.reduce((s, m) => s + m.orders, 0);
    const fulfilled = metrics.reduce((s, m) => s + m.fulfilled, 0);
    const fulfillmentRate = totalOrders > 0 ? (fulfilled / totalOrders) * 100 : 0;
    const pendingOrders = orders.filter((o) => IN_FLIGHT.includes(o.status)).length;
    const readyToDispatch = orders.filter((o) => o.status === "Ready to Dispatch").length;
    const delayed = orders.filter((o) => o.delayed).length;
    const dispatchedToday = metrics.find((m) => m.day === 0)?.fulfilled ?? 0;

    const lowStock = products.filter((p) => {
      const inv = inventory.find((i) => i.productId === p._id);
      return inv && inv.available <= p.reorderLevel;
    });
    const criticalStock = products.filter((p) => {
      const inv = inventory.find((i) => i.productId === p._id);
      return inv && (inv.available <= 0 || inv.available <= p.reorderLevel / 2);
    });

    const avg = (f: (m: (typeof metrics)[number]) => number) =>
      metrics.length ? metrics.reduce((s, m) => s + f(m), 0) / metrics.length : 0;

    const openExceptions = exceptions.filter((e) => e.status === "Open");
    const exceptionResolution =
      exceptions.length > 0 ? (exceptions.filter((e) => e.status === "Resolved").length / exceptions.length) * 100 : 100;
    const activeBottleneck = bottlenecks.some((b) => b.status === "Active");

    const efficiency = calculateWarehouseEfficiency({
      fulfillmentRate,
      onTimeDispatch: avg((m) => m.dispatchOnTimePct),
      inventoryAccuracy: clamp(100 - avg((m) => m.stockouts) * 3, 60, 100),
      pickingEfficiency: clamp(100 - (avg((m) => m.pickTimeMin) - 8) * 6 - (activeBottleneck ? 6 : 0), 55, 100),
      packingEfficiency: clamp(100 - (avg((m) => m.packTimeMin) - 5) * 5, 60, 100),
      exceptionResolution,
    });

    const orderFlow = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});

    const recentActivity = activity.sort((a, b) => b.at - a.at).slice(0, 14);
    const pendingDecisions = decisions
      .filter((d) => d.status === "Pending")
      .sort((a, b) => b.createdAt - a.createdAt);

    const lowStockSummary = lowStock
      .map((p) => {
        const inv = inventory.find((i) => i.productId === p._id)!;
        return { ...p, available: inv.available, incoming: inv.incoming };
      })
      .sort((a, b) => a.available / Math.max(1, a.avgDailyDemand) - b.available / Math.max(1, b.avgDailyDemand))
      .slice(0, 6);

    return {
      kpis: {
        totalOrders,
        pendingOrders,
        lowStockItems: lowStock.length,
        criticalStock: criticalStock.length,
        readyToDispatch,
        delayed,
        fulfillmentRate: Math.round(fulfillmentRate * 10) / 10,
        efficiencyScore: efficiency.score,
        dispatchedToday,
      },
      efficiency,
      orderFlow,
      activity: recentActivity,
      pendingDecisions,
      bottlenecks: bottlenecks.filter((b) => b.status === "Active"),
      lowStock: lowStockSummary,
      openExceptions: openExceptions.length,
    };
  },
});

export const getEfficiency = query({
  args: {},
  handler: async (ctx) => {
    const [orders, metrics, exceptions, bottlenecks] = await Promise.all([
      ctx.db.query("orders").collect(),
      ctx.db.query("metrics").collect(),
      ctx.db.query("exceptions").collect(),
      ctx.db.query("bottlenecks").collect(),
    ]);
    const totalOrders = metrics.reduce((s, m) => s + m.orders, 0);
    const fulfilled = metrics.reduce((s, m) => s + m.fulfilled, 0);
    const avg = (f: (m: (typeof metrics)[number]) => number) =>
      metrics.length ? metrics.reduce((s, m) => s + f(m), 0) / metrics.length : 0;
    const activeBottleneck = bottlenecks.some((b) => b.status === "Active");
    const efficiency = calculateWarehouseEfficiency({
      fulfillmentRate: totalOrders > 0 ? (fulfilled / totalOrders) * 100 : 0,
      onTimeDispatch: avg((m) => m.dispatchOnTimePct),
      inventoryAccuracy: clamp(100 - avg((m) => m.stockouts) * 3, 60, 100),
      pickingEfficiency: clamp(100 - (avg((m) => m.pickTimeMin) - 8) * 6 - (activeBottleneck ? 6 : 0), 55, 100),
      packingEfficiency: clamp(100 - (avg((m) => m.packTimeMin) - 5) * 5, 60, 100),
      exceptionResolution:
        exceptions.length > 0 ? (exceptions.filter((e) => e.status === "Resolved").length / exceptions.length) * 100 : 100,
    });
    return {
      efficiency,
      live: { openOrders: orders.filter((o) => IN_FLIGHT.includes(o.status)).length, activeBottleneck },
    };
  },
});

/* ---------------- master data ---------------- */

export const getInventory = query({
  args: {},
  handler: async (ctx) => {
    const [products, inventory, reorders] = await Promise.all([
      ctx.db.query("products").collect(),
      ctx.db.query("inventory").collect(),
      ctx.db.query("reorders").collect(),
    ]);
    return products
      .map((p) => {
        const inv = inventory.find((i) => i.productId === p._id);
        const pendingReorder = reorders.find((r) => r.productId === p._id && r.status === "Pending");
        return { ...p, inventory: inv, pendingReorder: pendingReorder ?? null };
      })
      .sort((a, b) => a.sku.localeCompare(b.sku));
  },
});

export const getReorders = query({
  args: {},
  handler: async (ctx) => {
    const [reorders, products] = await Promise.all([
      ctx.db.query("reorders").collect(),
      ctx.db.query("products").collect(),
    ]);
    return reorders
      .map((r) => ({ ...r, product: products.find((p) => p._id === r.productId) ?? null }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getWorkers = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("workers").collect()).sort((a, b) => a.name.localeCompare(b.name)),
});

export const getCustomers = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("customers").collect()).sort((a, b) => a.name.localeCompare(b.name)),
});

/* ---------------- orders ---------------- */

export const getOrders = query({
  args: {},
  handler: async (ctx) => {
    const [orders, products, customers] = await Promise.all([
      ctx.db.query("orders").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("customers").collect(),
    ]);
    const byId = new Map(products.map((p) => [p._id, p]));
    const custMap = new Map(customers.map((c) => [c._id, c]));
    return orders
      .map((o) => ({
        ...o,
        customer: custMap.get(o.customerId) ?? null,
        items: o.items.map((it) => ({ ...it, product: byId.get(it.productId) ?? null })),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getOrderDetail = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    const [customer, products] = await Promise.all([
      ctx.db.get(order.customerId),
      ctx.db.query("products").collect(),
    ]);
    const byId = new Map(products.map((p) => [p._id, p]));
    const exceptions = (await ctx.db.query("exceptions").collect()).filter((e) => e.orderId === order._id);
    return {
      ...order,
      customer,
      items: order.items.map((it) => ({ ...it, product: byId.get(it.productId) ?? null })),
      exceptions,
    };
  },
});

/* ---------------- tasks ---------------- */

export const getPicking = query({
  args: {},
  handler: async (ctx) => {
    const [tasks, orders, workers, products] = await Promise.all([
      ctx.db.query("pickingTasks").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("workers").collect(),
      ctx.db.query("products").collect(),
    ]);
    const orderMap = new Map(orders.map((o) => [o._id, o]));
    const workerMap = new Map(workers.map((w) => [w._id, w]));
    const productMap = new Map(products.map((p) => [p._id, p]));
    return tasks
      .map((t) => ({
        ...t,
        order: orderMap.get(t.orderId) ?? null,
        worker: workerMap.get(t.workerId) ?? null,
        itemProducts: t.items.map((i) => productMap.get(i.productId) ?? null),
      }))
      .sort((a, b) => {
        const rank: Record<string, number> = { Pending: 0, "In Progress": 1, Completed: 2, Failed: 3 };
        return (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      });
  },
});

export const getPacking = query({
  args: {},
  handler: async (ctx) => {
    const [tasks, orders, workers] = await Promise.all([
      ctx.db.query("packingTasks").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("workers").collect(),
    ]);
    const orderMap = new Map(orders.map((o) => [o._id, o]));
    const workerMap = new Map(workers.map((w) => [w._id, w]));
    return tasks
      .map((t) => ({ ...t, order: orderMap.get(t.orderId) ?? null, worker: workerMap.get(t.workerId) ?? null }))
      .sort((a, b) => {
        const rank: Record<string, number> = { Pending: 0, "In Progress": 1, Completed: 2, Failed: 3 };
        return (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      });
  },
});

export const getQc = query({
  args: {},
  handler: async (ctx) => {
    const [tasks, orders, workers] = await Promise.all([
      ctx.db.query("qcTasks").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("workers").collect(),
    ]);
    const orderMap = new Map(orders.map((o) => [o._id, o]));
    const workerMap = new Map(workers.map((w) => [w._id, w]));
    return tasks
      .map((t) => ({ ...t, order: orderMap.get(t.orderId) ?? null, inspector: t.inspectorId ? workerMap.get(t.inspectorId) ?? null : null }))
      .sort((a, b) => {
        const rank: Record<string, number> = { Pending: 0, Passed: 1, Failed: 2 };
        return (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      });
  },
});

export const getDispatch = query({
  args: {},
  handler: async (ctx) => {
    const [records, orders, customers] = await Promise.all([
      ctx.db.query("dispatchRecords").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("customers").collect(),
    ]);
    const orderMap = new Map(orders.map((o) => [o._id, o]));
    const customerMap = new Map(customers.map((c) => [c._id, c]));
    return records
      .map((r) => {
        const order = orderMap.get(r.orderId) ?? null;
        return {
          ...r,
          order,
          customer: order?.customerId ? customerMap.get(order.customerId) ?? null : null,
        };
      })
      .sort((a, b) => {
        const rank: Record<string, number> = { Ready: 0, Delayed: 1, Dispatched: 2 };
        return (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      });
  },
});

/* ---------------- exceptions + decisions ---------------- */

export const getExceptions = query({
  args: {},
  handler: async (ctx) => {
    const [exceptions, orders, products] = await Promise.all([
      ctx.db.query("exceptions").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("products").collect(),
    ]);
    const orderMap = new Map(orders.map((o) => [o._id, o]));
    const productMap = new Map(products.map((p) => [p._id, p]));
    return exceptions
      .map((e) => ({
        ...e,
        order: e.orderId ? orderMap.get(e.orderId) ?? null : null,
        product: e.productId ? productMap.get(e.productId) ?? null : null,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getDecisions = query({
  args: {},
  handler: async (ctx) => {
    const [decisions, orders, products] = await Promise.all([
      ctx.db.query("decisions").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("products").collect(),
    ]);
    const orderMap = new Map(orders.map((o) => [o._id, o]));
    const productMap = new Map(products.map((p) => [p._id, p]));
    return decisions
      .map((d) => ({
        ...d,
        order: d.relatedOrderId ? orderMap.get(d.relatedOrderId) ?? null : null,
        product: d.relatedProductId ? productMap.get(d.relatedProductId) ?? null : null,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getBottlenecks = query({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("bottlenecks").collect()).sort((a, b) => b.createdAt - a.createdAt),
});

/* ---------------- observability ---------------- */

export const getActivity = query({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) =>
    (await ctx.db.query("activityLog").collect()).sort((a, b) => b.at - a.at).slice(0, limit),
});

export const getNotifications = query({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("notifications").collect()).sort((a, b) => b.at - a.at),
});

export const getAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const [metrics, pickingTasks, workers, orders] = await Promise.all([
      ctx.db.query("metrics").collect(),
      ctx.db.query("pickingTasks").collect(),
      ctx.db.query("workers").collect(),
      ctx.db.query("orders").collect(),
    ]);
    return {
      metrics: metrics.sort((a, b) => b.day - a.day),
      pickingTasks,
      workers,
      orders: orders.map((o) => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        status: o.status,
        priorityLevel: o.priorityLevel,
        value: o.value,
        completedAt: o.completedAt,
        createdAt: o.createdAt,
      })),
    };
  },
});

/* ---------------- search + assistant ---------------- */

export const getSearchIndex = query({
  args: {},
  handler: async (ctx) => {
    const [orders, products, exceptions, workers, customers, inventory] = await Promise.all([
      ctx.db.query("orders").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("exceptions").collect(),
      ctx.db.query("workers").collect(),
      ctx.db.query("customers").collect(),
      ctx.db.query("inventory").collect(),
    ]);
    return {
      orders: orders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        priorityLevel: o.priorityLevel,
        value: o.value,
        customerId: o.customerId,
      })),
      customers: customers.map((c) => ({ name: c.name, tier: c.tier, city: c.city, _id: c._id })),
      products: products.map((p) => {
        const inv = inventory.find((i) => i.productId === p._id);
        return { sku: p.sku, name: p.name, category: p.category, location: p.location, available: inv?.available ?? 0, _id: p._id };
      }),
      exceptions: exceptions.map((e) => ({
        exceptionId: e.exceptionId,
        type: e.type,
        severity: e.severity,
        status: e.status,
        sku: e.sku,
        _id: e._id,
      })),
      workers: workers.map((w) => ({ name: w.name, role: w.role, zone: w.zone, _id: w._id })),
    };
  },
});

export const getAssistantSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const [orders, products, inventory, exceptions, bottlenecks, decisions, metrics, customers, workers, activity] = await Promise.all([
      ctx.db.query("orders").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("inventory").collect(),
      ctx.db.query("exceptions").collect(),
      ctx.db.query("bottlenecks").collect(),
      ctx.db.query("decisions").collect(),
      ctx.db.query("metrics").collect(),
      ctx.db.query("customers").collect(),
      ctx.db.query("workers").collect(),
      ctx.db.query("activityLog").collect(),
    ]);
    return {
      orders: orders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        priorityLevel: o.priorityLevel,
        priorityScore: o.priorityScore,
        priorityReasons: o.priorityReasons,
        deadline: o.deadline,
        value: o.value,
        delayed: o.delayed,
        hasException: o.hasException,
        inventoryStatus: o.inventoryStatus,
        customerName: customers.find((c) => c._id === o.customerId)?.name ?? "",
        items: o.items.map((i) => ({ qty: i.qty, allocated: i.allocated, productId: i.productId })),
      })),
      products: products.map((p) => {
        const inv = inventory.find((i) => i.productId === p._id);
        return {
          sku: p.sku,
          name: p.name,
          category: p.category,
          zone: p.zone,
          location: p.location,
          avgDailyDemand: p.avgDailyDemand,
          leadTimeDays: p.leadTimeDays,
          safetyStock: p.safetyStock,
          reorderLevel: p.reorderLevel,
          available: inv?.available ?? 0,
          reserved: inv?.reserved ?? 0,
          damaged: inv?.damaged ?? 0,
          incoming: inv?.incoming ?? 0,
        };
      }),
      exceptions: exceptions.map((e) => ({
        exceptionId: e.exceptionId,
        type: e.type,
        severity: e.severity,
        status: e.status,
        sku: e.sku,
        aiRecommendation: e.aiRecommendation,
        orderNumber: e.orderId ? orders.find((o) => o._id === e.orderId)?.orderNumber ?? "" : "",
      })),
      bottlenecks: bottlenecks.filter((b) => b.status === "Active").map((b) => ({
        bottleneckId: b.bottleneckId,
        area: b.area,
        zone: b.zone,
        avgTime: b.avgTime,
        normal: b.normal,
        pctIncrease: b.pctIncrease,
        recommendation: b.recommendation,
      })),
      decisions: decisions.filter((d) => d.status === "Pending").map((d) => ({
        decisionId: d.decisionId,
        type: d.type,
        problem: d.problem,
        recommendation: d.recommendation,
        orderNumber: d.relatedOrderId ? orders.find((o) => o._id === d.relatedOrderId)?.orderNumber ?? "" : "",
      })),
      metrics: metrics.sort((a, b) => a.day - b.day),
      workers: workers.map((w) => ({ name: w.name, role: w.role, zone: w.zone, active: w.active })),
      activity: activity.sort((a, b) => b.at - a.at).slice(0, 12),
    };
  },
});
