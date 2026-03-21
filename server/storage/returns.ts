/**
 * Returns storage module — complete return lifecycle from request through resolution.
 *
 * Handles: return number generation, policy-based validation (return windows,
 * restocking fees, shipping responsibility), state machine transitions,
 * stock restoration on receive, and sync queue integration.
 */

import { eq, and, sql, desc, ne } from "drizzle-orm";
import { db } from "../db.js";
import {
  onlineStoreReturns,
  onlineStoreReturnItems,
  onlineStoreOrders,
  onlineStoreOrderItems,
  products,
  stockMovements,
  onlineReturnNumberSequence,
  type OnlineStoreReturn,
  type OnlineStoreReturnItem,
  type OnlineStoreOrderItem,
} from "../schema.js";
import { getStoreSettings } from "./settings.js";
import { enqueueStockRestore } from "../sync/stockSync.js";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReturnWithItems = OnlineStoreReturn & {
  items: OnlineStoreReturnItem[];
};

// ---------------------------------------------------------------------------
// Number generation
// ---------------------------------------------------------------------------

/**
 * Atomically generate the next return number for the current year.
 * Format: RET-YYYY-NNNN (zero-padded to 4 digits).
 */
export async function generateReturnNumber(): Promise<string> {
  const year = new Date().getFullYear();
  return db.transaction(async (tx) => {
    const [rows] = await tx.execute(
      sql.raw(
        `SELECT * FROM \`online_return_number_sequence\` WHERE year = ${year} FOR UPDATE`,
      ),
    );
    const seq = Array.isArray(rows) ? (rows[0] as any) : (rows as any);
    if (!seq) {
      await tx.execute(
        sql.raw(
          `INSERT INTO \`online_return_number_sequence\` (year, last_number) VALUES (${year}, 1)`,
        ),
      );
      return `RET-${year}-0001`;
    }
    const nextNum = (seq.last_number || 0) + 1;
    await tx.execute(
      sql.raw(
        `UPDATE \`online_return_number_sequence\` SET last_number = ${nextNum} WHERE year = ${year}`,
      ),
    );
    return `RET-${year}-${String(nextNum).padStart(4, "0")}`;
  });
}

// ---------------------------------------------------------------------------
// Reason classification helpers
// ---------------------------------------------------------------------------

/** Reasons where the defect/fault is on the store side. */
const STORE_FAULT_REASONS = [
  "defective",
  "wrong_part",
  "damaged_in_shipping",
] as const;

function isStoreFaultReason(reason: string): boolean {
  return (STORE_FAULT_REASONS as readonly string[]).includes(reason);
}

// ---------------------------------------------------------------------------
// Return creation
// ---------------------------------------------------------------------------

/**
 * Create a new return request with full policy validation.
 *
 * Validates: order ownership, order status, item membership, quantities,
 * duplicate active returns, return window, shipping responsibility,
 * and restocking fee calculation.
 */
export async function createReturnRequest(params: {
  orderId: string;
  customerId: string;
  items: Array<{ orderItemId: string; quantity: number; reason: string }>;
  reasonDetails?: string;
}): Promise<ReturnWithItems> {
  const { orderId, customerId, items: requestedItems, reasonDetails } = params;

  if (requestedItems.length === 0) {
    throw new Error("At least one item is required for a return request");
  }

  // 1. Load order, verify ownership and status
  const [order] = await db
    .select()
    .from(onlineStoreOrders)
    .where(eq(onlineStoreOrders.id, orderId))
    .limit(1);
  if (!order) throw new Error("Order not found");
  if (order.customerId !== customerId)
    throw new Error("You do not own this order");
  if (order.status !== "delivered")
    throw new Error(
      `Returns can only be requested for delivered orders (current status: "${order.status}")`,
    );

  // 2. Load store settings for return policy
  const settings = await getStoreSettings();
  const returnWindowDays = settings?.returnWindowDays ?? 14;
  const defectiveReturnWindowDays = settings?.defectiveReturnWindowDays ?? 30;
  const restockingFeePercent = settings
    ? parseFloat(settings.restockingFeePercent)
    : 15;

  // 3. Load all order items for this order
  const orderItems = await db
    .select()
    .from(onlineStoreOrderItems)
    .where(eq(onlineStoreOrderItems.orderId, orderId));
  const orderItemMap = new Map(orderItems.map((oi) => [oi.id, oi]));

  // 4. Validate each requested item
  for (const ri of requestedItems) {
    const orderItem = orderItemMap.get(ri.orderItemId);
    if (!orderItem) {
      throw new Error(
        `Order item "${ri.orderItemId}" does not belong to this order`,
      );
    }
    if (ri.quantity <= 0) {
      throw new Error("Return quantity must be greater than zero");
    }
    if (ri.quantity > orderItem.quantity) {
      throw new Error(
        `Cannot return ${ri.quantity} units of "${orderItem.productName}" — only ${orderItem.quantity} were ordered`,
      );
    }
  }

  // 5. Check no existing active (non-rejected) returns on the same order items
  const existingReturns = await db
    .select()
    .from(onlineStoreReturns)
    .where(
      and(
        eq(onlineStoreReturns.orderId, orderId),
        ne(onlineStoreReturns.status, "rejected"),
      ),
    );

  if (existingReturns.length > 0) {
    const existingReturnIds = existingReturns.map((r) => r.id);
    const existingReturnItems = await db
      .select()
      .from(onlineStoreReturnItems)
      .where(
        sql`${onlineStoreReturnItems.returnId} IN (${sql.join(
          existingReturnIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    const activeItemIds = new Set(
      existingReturnItems.map((eri) => eri.orderItemId),
    );
    for (const ri of requestedItems) {
      if (activeItemIds.has(ri.orderItemId)) {
        const orderItem = orderItemMap.get(ri.orderItemId)!;
        throw new Error(
          `An active return already exists for "${orderItem.productName}"`,
        );
      }
    }
  }

  // 6. Check return window per item based on reason
  const deliveredAt = order.deliveredAt;
  if (!deliveredAt) {
    throw new Error("Order delivery date is missing — cannot verify return window");
  }
  const now = new Date();
  for (const ri of requestedItems) {
    const isDefective =
      ri.reason === "defective" ||
      ri.reason === "damaged_in_shipping";
    const windowDays = isDefective
      ? defectiveReturnWindowDays
      : returnWindowDays;
    const deadline = new Date(deliveredAt.getTime() + windowDays * 86_400_000);
    if (now > deadline) {
      const orderItem = orderItemMap.get(ri.orderItemId)!;
      throw new Error(
        `Return window (${windowDays} days) has expired for "${orderItem.productName}"`,
      );
    }
  }

  // 7. Determine shipping responsibility and restocking fee
  //    Use the "worst" reason across items for the overall return
  const primaryReason = requestedItems[0].reason;
  const returnShippingPaidBy = isStoreFaultReason(primaryReason)
    ? "store"
    : "customer";

  // 8. Calculate totals
  let totalItemValue = 0;
  let totalRestockingFee = 0;
  for (const ri of requestedItems) {
    const orderItem = orderItemMap.get(ri.orderItemId)!;
    const lineValue =
      parseFloat(orderItem.unitPrice) * ri.quantity;
    totalItemValue += lineValue;

    if (!isStoreFaultReason(ri.reason)) {
      totalRestockingFee += lineValue * (restockingFeePercent / 100);
    }
  }
  const refundAmount = totalItemValue - totalRestockingFee;

  // 9. Transaction: generate return number, insert return + items
  const returnId = randomUUID();

  const result = await db.transaction(async (tx) => {
    const returnNumber = await generateReturnNumber();

    await tx.insert(onlineStoreReturns).values({
      id: returnId,
      returnNumber,
      orderId,
      customerId,
      status: "requested",
      reason: primaryReason as any,
      reasonDetails: reasonDetails || null,
      refundAmount: refundAmount.toFixed(2),
      restockingFee: totalRestockingFee.toFixed(2),
      returnShippingPaidBy,
    });

    const returnItems: OnlineStoreReturnItem[] = [];
    for (const ri of requestedItems) {
      const itemId = randomUUID();
      await tx.insert(onlineStoreReturnItems).values({
        id: itemId,
        returnId,
        orderItemId: ri.orderItemId,
        quantity: ri.quantity,
        reason: ri.reason,
      });

      returnItems.push({
        id: itemId,
        returnId,
        orderItemId: ri.orderItemId,
        quantity: ri.quantity,
        reason: ri.reason,
        conditionOnReturn: null,
        createdAt: new Date(),
      });
    }

    const [returnRow] = await tx
      .select()
      .from(onlineStoreReturns)
      .where(eq(onlineStoreReturns.id, returnId))
      .limit(1);

    return { ...returnRow, items: returnItems };
  });

  return result;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch a single return by ID with its line items.
 */
export async function getReturn(
  id: string,
): Promise<ReturnWithItems | null> {
  const [returnRow] = await db
    .select()
    .from(onlineStoreReturns)
    .where(eq(onlineStoreReturns.id, id))
    .limit(1);
  if (!returnRow) return null;
  const items = await db
    .select()
    .from(onlineStoreReturnItems)
    .where(eq(onlineStoreReturnItems.returnId, id));
  return { ...returnRow, items };
}

/**
 * Paginated returns for a specific customer.
 */
export async function getReturnsByCustomer(
  customerId: string,
  page = 1,
  limit = 20,
): Promise<{ returns: OnlineStoreReturn[]; total: number }> {
  const offset = (page - 1) * limit;
  const whereClause = eq(onlineStoreReturns.customerId, customerId);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(onlineStoreReturns)
    .where(whereClause);
  const returns = await db
    .select()
    .from(onlineStoreReturns)
    .where(whereClause)
    .orderBy(desc(onlineStoreReturns.createdAt))
    .limit(limit)
    .offset(offset);

  return { returns, total: countResult?.count || 0 };
}

/**
 * Admin: all returns with optional status/search filters, paginated.
 */
export async function getAllReturns(
  filters: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ returns: OnlineStoreReturn[]; total: number }> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.limit || 20));
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof eq>[] = [];
  if (filters.status)
    conditions.push(eq(onlineStoreReturns.status, filters.status as any));
  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      sql`(LOWER(${onlineStoreReturns.returnNumber}) LIKE ${term})` as any,
    );
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(onlineStoreReturns)
    .where(whereClause);
  const returns = await db
    .select()
    .from(onlineStoreReturns)
    .where(whereClause)
    .orderBy(desc(onlineStoreReturns.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { returns, total: countResult?.count || 0 };
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

/**
 * Approve a return request.
 * requested -> approved
 */
export async function approveReturn(
  id: string,
  approvedBy: string,
): Promise<void> {
  const [ret] = await db
    .select()
    .from(onlineStoreReturns)
    .where(eq(onlineStoreReturns.id, id))
    .limit(1);
  if (!ret) throw new Error("Return not found");
  if (ret.status !== "requested")
    throw new Error(
      `Cannot approve return in "${ret.status}" status — must be "requested"`,
    );

  await db
    .update(onlineStoreReturns)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedBy,
      updatedAt: new Date(),
    })
    .where(eq(onlineStoreReturns.id, id));
}

/**
 * Reject a return request.
 * requested -> rejected
 */
export async function rejectReturn(
  id: string,
  rejectedBy: string,
  reason: string,
): Promise<void> {
  const [ret] = await db
    .select()
    .from(onlineStoreReturns)
    .where(eq(onlineStoreReturns.id, id))
    .limit(1);
  if (!ret) throw new Error("Return not found");
  if (ret.status !== "requested")
    throw new Error(
      `Cannot reject return in "${ret.status}" status — must be "requested"`,
    );

  await db
    .update(onlineStoreReturns)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      rejectedBy,
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(onlineStoreReturns.id, id));
}

/**
 * Mark a return as shipped back by the customer.
 * approved -> shipped_back
 */
export async function markReturnShippedBack(
  id: string,
  trackingNumber: string,
): Promise<void> {
  const [ret] = await db
    .select()
    .from(onlineStoreReturns)
    .where(eq(onlineStoreReturns.id, id))
    .limit(1);
  if (!ret) throw new Error("Return not found");
  if (ret.status !== "approved")
    throw new Error(
      `Cannot mark return as shipped back in "${ret.status}" status — must be "approved"`,
    );

  await db
    .update(onlineStoreReturns)
    .set({
      status: "shipped_back",
      shippedBackAt: new Date(),
      shippedBackTrackingNumber: trackingNumber,
      updatedAt: new Date(),
    })
    .where(eq(onlineStoreReturns.id, id));
}

/**
 * Receive a returned shipment, update item conditions, restock products,
 * record stock movements, and enqueue sync restore for the garage app.
 * shipped_back -> received
 */
export async function receiveReturn(
  id: string,
  receivedBy: string,
  itemConditions: Array<{ returnItemId: string; condition: string }>,
): Promise<void> {
  const [ret] = await db
    .select()
    .from(onlineStoreReturns)
    .where(eq(onlineStoreReturns.id, id))
    .limit(1);
  if (!ret) throw new Error("Return not found");
  if (ret.status !== "shipped_back")
    throw new Error(
      `Cannot receive return in "${ret.status}" status — must be "shipped_back"`,
    );

  // Load return items
  const returnItems = await db
    .select()
    .from(onlineStoreReturnItems)
    .where(eq(onlineStoreReturnItems.returnId, id));
  const returnItemMap = new Map(returnItems.map((ri) => [ri.id, ri]));

  // Load the corresponding order items to get productId
  const orderItemIds = returnItems.map((ri) => ri.orderItemId);
  const orderItems = orderItemIds.length > 0
    ? await db
        .select()
        .from(onlineStoreOrderItems)
        .where(
          sql`${onlineStoreOrderItems.id} IN (${sql.join(
            orderItemIds.map((oid) => sql`${oid}`),
            sql`, `,
          )})`,
        )
    : [];
  const orderItemMap = new Map(orderItems.map((oi) => [oi.id, oi]));

  // Build condition lookup
  const conditionMap = new Map(
    itemConditions.map((ic) => [ic.returnItemId, ic.condition]),
  );

  // Transaction: update conditions, restock products, record stock movements
  await db.transaction(async (tx) => {
    for (const ri of returnItems) {
      const condition = conditionMap.get(ri.id) || "unknown";
      const orderItem = orderItemMap.get(ri.orderItemId);
      if (!orderItem) continue;

      // Update item condition
      await tx
        .update(onlineStoreReturnItems)
        .set({ conditionOnReturn: condition })
        .where(eq(onlineStoreReturnItems.id, ri.id));

      // Restock product quantity
      await tx.execute(
        sql`UPDATE products SET quantity = quantity + ${ri.quantity} WHERE id = ${orderItem.productId}`,
      );

      // Record stock movement
      await tx.insert(stockMovements).values({
        id: randomUUID(),
        productId: orderItem.productId,
        movementType: "returned",
        quantity: ri.quantity,
        referenceType: "return",
        referenceId: id,
        notes: `Return ${ret.returnNumber} — condition: ${condition}`,
        performedBy: receivedBy,
      });
    }

    // Update return status
    await tx
      .update(onlineStoreReturns)
      .set({
        status: "received",
        receivedAt: new Date(),
        receivedBy,
        updatedAt: new Date(),
      })
      .where(eq(onlineStoreReturns.id, id));
  });

  // After transaction: enqueue stock restore sync events for the garage app
  const syncItems = await buildSyncItems(returnItems, orderItemMap);
  await enqueueStockRestore(syncItems, ret.orderId, "return_received");
}

/**
 * Process a refund for a received return.
 * received -> refunded
 * Blocks refund if any item's product category is "Electrical" (case-insensitive).
 */
export async function refundReturn(id: string): Promise<void> {
  const [ret] = await db
    .select()
    .from(onlineStoreReturns)
    .where(eq(onlineStoreReturns.id, id))
    .limit(1);
  if (!ret) throw new Error("Return not found");
  if (ret.status !== "received")
    throw new Error(
      `Cannot refund return in "${ret.status}" status — must be "received"`,
    );

  // Load return items and their order items to get product IDs
  const returnItems = await db
    .select()
    .from(onlineStoreReturnItems)
    .where(eq(onlineStoreReturnItems.returnId, id));

  const orderItemIds = returnItems.map((ri) => ri.orderItemId);
  const orderItems = orderItemIds.length > 0
    ? await db
        .select()
        .from(onlineStoreOrderItems)
        .where(
          sql`${onlineStoreOrderItems.id} IN (${sql.join(
            orderItemIds.map((oid) => sql`${oid}`),
            sql`, `,
          )})`,
        )
    : [];

  // Load products to check categories
  const productIds = orderItems.map((oi) => oi.productId);
  if (productIds.length > 0) {
    const productRows = await db
      .select({ id: products.id, category: products.category })
      .from(products)
      .where(
        sql`${products.id} IN (${sql.join(
          productIds.map((pid) => sql`${pid}`),
          sql`, `,
        )})`,
      );

    for (const prod of productRows) {
      if (prod.category && prod.category.toLowerCase() === "electrical") {
        throw new Error(
          "Refund blocked: return contains electrical parts — use exchange or store credit instead",
        );
      }
    }
  }

  await db
    .update(onlineStoreReturns)
    .set({
      status: "refunded",
      resolution: "refund",
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onlineStoreReturns.id, id));
}

/**
 * Resolve a received return as an exchange.
 * received -> exchanged
 */
export async function exchangeReturn(
  id: string,
  staffNotes?: string,
): Promise<void> {
  const [ret] = await db
    .select()
    .from(onlineStoreReturns)
    .where(eq(onlineStoreReturns.id, id))
    .limit(1);
  if (!ret) throw new Error("Return not found");
  if (ret.status !== "received")
    throw new Error(
      `Cannot exchange return in "${ret.status}" status — must be "received"`,
    );

  await db
    .update(onlineStoreReturns)
    .set({
      status: "exchanged",
      resolution: "exchange",
      staffNotes: staffNotes || ret.staffNotes,
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onlineStoreReturns.id, id));
}

/**
 * Resolve a received return as store credit.
 * received -> closed
 */
export async function storeCreditReturn(
  id: string,
  staffNotes?: string,
): Promise<void> {
  const [ret] = await db
    .select()
    .from(onlineStoreReturns)
    .where(eq(onlineStoreReturns.id, id))
    .limit(1);
  if (!ret) throw new Error("Return not found");
  if (ret.status !== "received")
    throw new Error(
      `Cannot issue store credit for return in "${ret.status}" status — must be "received"`,
    );

  await db
    .update(onlineStoreReturns)
    .set({
      status: "closed",
      resolution: "store_credit",
      staffNotes: staffNotes || ret.staffNotes,
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onlineStoreReturns.id, id));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map return items to the shape expected by enqueueStockRestore.
 * Looks up each product's garagePartId so the garage app knows which part to adjust.
 */
async function buildSyncItems(
  returnItems: OnlineStoreReturnItem[],
  orderItemMap: Map<string, OnlineStoreOrderItem>,
): Promise<Array<{ garagePartId: string | null; quantity: number }>> {
  if (returnItems.length === 0) return [];

  const productIds: string[] = [];
  for (const ri of returnItems) {
    const oi = orderItemMap.get(ri.orderItemId);
    if (oi) productIds.push(oi.productId);
  }
  if (productIds.length === 0) return [];

  const productRows = await db
    .select({ id: products.id, garagePartId: products.garagePartId })
    .from(products)
    .where(
      sql`${products.id} IN (${sql.join(
        productIds.map((pid) => sql`${pid}`),
        sql`, `,
      )})`,
    );
  const garageIdMap = new Map(
    productRows.map((p) => [p.id, p.garagePartId]),
  );

  return returnItems
    .map((ri) => {
      const oi = orderItemMap.get(ri.orderItemId);
      if (!oi) return null;
      return {
        garagePartId: garageIdMap.get(oi.productId) ?? null,
        quantity: ri.quantity,
      };
    })
    .filter((item): item is { garagePartId: string | null; quantity: number } =>
      item !== null,
    );
}
