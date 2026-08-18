import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/* ------------------------------------------------------------------ */
/* SmartFulfill AI — warehouse domain types                            */
/* ------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  "Pending",
  "Picking",
  "Packing",
  "Quality Check",
  "Ready to Dispatch",
  "Dispatched",
  "Delayed",
  "Exception",
  "Completed",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PRIORITY_LEVELS = ["Critical", "High", "Medium", "Low"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const INVENTORY_STATUSES = [
  "Available",
  "Partial",
  "Shortage",
  "Backordered",
  "Out",
] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const TASK_STATUSES = ["Pending", "In Progress", "Completed", "Failed"] as const;

export const timelineStageValidator = v.union(
  v.literal("done"),
  v.literal("partial"),
  v.literal("pending"),
);

export const timelineEventValidator = v.object({
  key: v.string(),
  label: v.string(),
  state: timelineStageValidator,
  at: v.number(),
  note: v.optional(v.string()),
});

export const orderItemValidator = v.object({
  productId: v.id("products"),
  qty: v.number(),
  allocated: v.number(),
  fulfilled: v.number(),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
    }).index("email", ["email"]),

    /* ---------------- master data ---------------- */

    products: defineTable({
      sku: v.string(),
      name: v.string(),
      category: v.string(),
      price: v.number(),
      zone: v.string(), // warehouse zone A | B | C
      location: v.string(), // storage cell e.g. "B2"
      avgDailyDemand: v.number(),
      leadTimeDays: v.number(),
      safetyStock: v.number(),
      reorderLevel: v.number(),
      unit: v.string(),
    })
      .index("by_sku", ["sku"])
      .index("by_category", ["category"]),

    inventory: defineTable({
      productId: v.id("products"),
      available: v.number(),
      reserved: v.number(),
      damaged: v.number(),
      incoming: v.number(),
    }).index("by_product", ["productId"]),

    customers: defineTable({
      name: v.string(),
      tier: v.string(), // Platinum | Premium | Standard | Basic
      city: v.string(),
      phone: v.optional(v.string()),
    }),

    workers: defineTable({
      name: v.string(),
      role: v.string(), // Picker | Packer | QC Inspector | Dispatcher
      zone: v.string(),
      active: v.boolean(),
      tasksCompleted: v.number(),
      avgPickTimeMin: v.number(),
    }),

    /* ---------------- operational flow ---------------- */

    orders: defineTable({
      orderNumber: v.string(),
      customerId: v.id("customers"),
      items: v.array(orderItemValidator),
      value: v.number(),
      priorityScore: v.number(),
      priorityLevel: priorityLevelValidator(),
      priorityReasons: v.array(v.string()),
      deadline: v.number(),
      createdAt: v.number(),
      status: orderStatusValidator(),
      inventoryStatus: inventoryStatusValidator(),
      timeline: v.array(timelineEventValidator),
      delayed: v.boolean(),
      hasException: v.boolean(),
      completedAt: v.optional(v.number()),
    })
      .index("by_status", ["status"])
      .index("by_number", ["orderNumber"])
      .index("by_priority", ["priorityScore"]),

    pickingTasks: defineTable({
      taskId: v.string(),
      orderId: v.id("orders"),
      workerId: v.id("workers"),
      items: v.array(orderItemValidator),
      locations: v.array(v.string()),
      route: v.array(v.string()),
      originalDistance: v.number(),
      optimizedDistance: v.number(),
      savedPct: v.number(),
      status: taskStatusValidator(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      assignedAt: v.number(),
    }).index("by_status", ["status"]),

    packingTasks: defineTable({
      taskId: v.string(),
      orderId: v.id("orders"),
      station: v.string(),
      workerId: v.id("workers"),
      status: taskStatusValidator(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      note: v.optional(v.string()),
    }).index("by_status", ["status"]),

    qcTasks: defineTable({
      taskId: v.string(),
      orderId: v.id("orders"),
      status: v.union(
        v.literal("Pending"),
        v.literal("Passed"),
        v.literal("Failed"),
      ),
      inspectorId: v.optional(v.id("workers")),
      inspectedAt: v.optional(v.number()),
      note: v.optional(v.string()),
    }).index("by_status", ["status"]),

    dispatchRecords: defineTable({
      dispatchId: v.string(),
      orderId: v.id("orders"),
      carrier: v.string(),
      packageWeight: v.string(),
      destination: v.string(),
      deadline: v.number(),
      status: v.union(v.literal("Ready"), v.literal("Dispatched"), v.literal("Delayed")),
      dispatchedAt: v.optional(v.number()),
    }).index("by_status", ["status"]),

    /* ---------------- intelligence ---------------- */

    exceptions: defineTable({
      exceptionId: v.string(),
      type: v.string(), // Stock shortage | Stockout | Damaged item | ...
      severity: severityValidator(),
      orderId: v.optional(v.id("orders")),
      productId: v.optional(v.id("products")),
      sku: v.optional(v.string()),
      quantity: v.optional(v.number()),
      description: v.string(),
      impact: v.string(),
      aiRecommendation: v.string(),
      status: v.union(v.literal("Open"), v.literal("Resolved")),
      decisionHistory: v.array(
        v.object({ stage: v.string(), at: v.number() }),
      ),
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
      resolution: v.optional(v.string()),
    }).index("by_status", ["status"]),

    decisions: defineTable({
      decisionId: v.string(),
      type: v.string(), // allocation | reorder | bottleneck | damage | dispatch | qc | packing
      problem: v.string(),
      analysis: v.string(),
      recommendation: v.string(),
      expectedImpact: v.array(v.string()),
      relatedOrderId: v.optional(v.id("orders")),
      relatedProductId: v.optional(v.id("products")),
      relatedExceptionId: v.optional(v.id("exceptions")),
      payload: v.optional(v.any()),
      status: v.union(
        v.literal("Pending"),
        v.literal("Applied"),
        v.literal("Overridden"),
        v.literal("Ignored"),
      ),
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
    }).index("by_status", ["status"]),

    reorders: defineTable({
      productId: v.id("products"),
      quantity: v.number(),
      reason: v.string(),
      status: v.union(v.literal("Pending"), v.literal("Created"), v.literal("Ignored")),
      createdAt: v.number(),
    }).index("by_product", ["productId"]),

    bottlenecks: defineTable({
      bottleneckId: v.string(),
      area: v.string(),
      zone: v.string(),
      avgTime: v.number(),
      normal: v.number(),
      pctIncrease: v.number(),
      recommendation: v.string(),
      status: v.union(v.literal("Active"), v.literal("Resolved")),
      createdAt: v.number(),
    }),

    /* ---------------- observability ---------------- */

    activityLog: defineTable({
      type: v.union(v.literal("success"), v.literal("warning"), v.literal("error"), v.literal("info")),
      message: v.string(),
      orderNumber: v.optional(v.string()),
      at: v.number(),
    }),

    notifications: defineTable({
      message: v.string(),
      severity: v.union(v.literal("critical"), v.literal("warning"), v.literal("info"), v.literal("success")),
      read: v.boolean(),
      at: v.number(),
    }),

    metrics: defineTable({
      day: v.number(), // days ago from seed date
      orders: v.number(),
      fulfilled: v.number(),
      stockouts: v.number(),
      exceptions: v.number(),
      pickTimeMin: v.number(),
      packTimeMin: v.number(),
      dispatchOnTimePct: v.number(),
      fulfillmentRate: v.number(),
      zoneA: v.number(),
      zoneB: v.number(),
      zoneC: v.number(),
    }),
  },
  {
    schemaValidation: false,
  },
);

export default schema;

/* helper validators (kept below to avoid forward-reference issues) */
function priorityLevelValidator() {
  return v.union(
    v.literal("Critical"),
    v.literal("High"),
    v.literal("Medium"),
    v.literal("Low"),
  );
}
function orderStatusValidator() {
  return v.union(
    v.literal("Pending"),
    v.literal("Picking"),
    v.literal("Packing"),
    v.literal("Quality Check"),
    v.literal("Ready to Dispatch"),
    v.literal("Dispatched"),
    v.literal("Delayed"),
    v.literal("Exception"),
    v.literal("Completed"),
  );
}
function inventoryStatusValidator() {
  return v.union(
    v.literal("Available"),
    v.literal("Partial"),
    v.literal("Shortage"),
    v.literal("Backordered"),
    v.literal("Out"),
  );
}
function severityValidator() {
  return v.union(v.literal("Critical"), v.literal("High"), v.literal("Medium"), v.literal("Low"));
}
function taskStatusValidator() {
  return v.union(
    v.literal("Pending"),
    v.literal("In Progress"),
    v.literal("Completed"),
    v.literal("Failed"),
  );
}
