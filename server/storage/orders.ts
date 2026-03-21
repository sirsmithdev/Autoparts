/**
 * Order storage module — order lifecycle from creation through fulfillment.
 *
 * Extracted from onlineStore.ts with updated table references:
 *   users → customers, partsInventory → products,
 *   partId/partName/partNumber → productId/productName/productNumber,
 *   pricingSettings → storeSettings
 *
 * Integrates with sync queue to propagate stock changes back to the garage app.
 */

import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../db.js";
import {
  onlineStoreOrders,
  onlineStoreOrderItems,
  products,
  customers,
  shoppingCarts,
  shoppingCartItems,
  storeSettings,
  deliveryZones,
  onlineOrderNumberSequence,
  type OnlineStoreOrder,
  type OnlineStoreOrderItem,
} from "../schema.js";
import {
  enqueueStockDecrement,
  enqueueStockRestore,
} from "../sync/stockSync.js";
import { createPickListForOrder } from "./pickLists.js";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderWithItems = OnlineStoreOrder & {
  items: OnlineStoreOrderItem[];
};

type OrderStatus = OnlineStoreOrder["status"];

// ---------------------------------------------------------------------------
// Number generation
// ---------------------------------------------------------------------------

/**
 * Atomically generate the next order number for the current year.
 * Format: ORD-YYYY-NNNN (zero-padded to 4 digits).
 */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  return db.transaction(async (tx) => {
    const [rows] = await tx.execute(
      sql.raw(
        `SELECT * FROM \`online_order_number_sequence\` WHERE year = ${year} FOR UPDATE`,
      ),
    );
    const seq = Array.isArray(rows) ? (rows[0] as any) : (rows as any);
    if (!seq) {
      await tx.execute(
        sql.raw(
          `INSERT INTO \`online_order_number_sequence\` (year, last_number) VALUES (${year}, 1)`,
        ),
      );
      return `ORD-${year}-0001`;
    }
    const nextNum = (seq.last_number || 0) + 1;
    await tx.execute(
      sql.raw(
        `UPDATE \`online_order_number_sequence\` SET last_number = ${nextNum} WHERE year = ${year}`,
      ),
    );
    return `ORD-${year}-${String(nextNum).padStart(4, "0")}`;
  });
}

// ---------------------------------------------------------------------------
// Order creation
// ---------------------------------------------------------------------------

/**
 * Create a pending-payment order from the customer's cart.
 *
 * 1. Snapshot customer info, validate stock, compute totals
 * 2. In a single transaction: decrement product stock, insert order + items,
 *    clear cart
 * 3. After commit: enqueue stock-decrement events for the garage sync queue
 */
export async function createPendingOrder(params: {
  customerId: string;
  deliveryMethod: "local_delivery" | "pickup";
  deliveryZoneId?: string;
  deliveryAddress?: string;
  deliveryParish?: string;
  deliveryNotes?: string;
}): Promise<{ order: OnlineStoreOrder; items: OnlineStoreOrderItem[] }> {
  const {
    customerId,
    deliveryMethod,
    deliveryZoneId,
    deliveryAddress,
    deliveryParish,
    deliveryNotes,
  } = params;

  // 1. Get customer
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) throw new Error("Customer not found");

  // 2. Get cart items with current product data
  const [cart] = await db
    .select()
    .from(shoppingCarts)
    .where(eq(shoppingCarts.customerId, customerId))
    .limit(1);
  if (!cart) throw new Error("Cart is empty");

  const cartItems = await db
    .select()
    .from(shoppingCartItems)
    .where(eq(shoppingCartItems.cartId, cart.id));
  if (cartItems.length === 0) throw new Error("Cart is empty");

  const productIds = cartItems.map((i) => i.productId);
  const productRows = await db
    .select()
    .from(products)
    .where(
      sql`${products.id} IN (${sql.join(
        productIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  // 3. Validate stock
  for (const ci of cartItems) {
    const prod = productMap.get(ci.productId);
    if (!prod) throw new Error("Product not found in catalog");
    if (prod.quantity < ci.quantity)
      throw new Error(`Insufficient stock for ${prod.name}`);
  }

  // 4. Tax rate from storeSettings
  const [settings] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.id, 1))
    .limit(1);
  const taxRate = settings ? parseFloat(settings.taxRate) : 0;

  // 5. Delivery fee
  let deliveryFee = "0.00";
  if (deliveryMethod === "local_delivery" && deliveryZoneId) {
    const [zone] = await db
      .select()
      .from(deliveryZones)
      .where(eq(deliveryZones.id, deliveryZoneId))
      .limit(1);
    if (!zone) throw new Error("Invalid delivery zone");
    const hasOversized = cartItems.some(
      (ci) => productMap.get(ci.productId)?.isOversized,
    );
    deliveryFee = hasOversized
      ? (
          parseFloat(zone.deliveryFee) + parseFloat(zone.oversizedSurcharge)
        ).toFixed(2)
      : zone.deliveryFee;
  }

  // 6. Transaction: decrement stock, insert order + items, clear cart
  const orderId = randomUUID();

  const result = await db.transaction(async (tx) => {
    const orderNumber = await generateOrderNumber();
    const orderItems: OnlineStoreOrderItem[] = [];
    let subtotal = 0;

    for (const ci of cartItems) {
      const prod = productMap.get(ci.productId)!;

      // Atomic stock decrement — fails if another transaction grabbed stock first
      const [updateResult] = await tx.execute(
        sql`UPDATE products SET quantity = quantity - ${ci.quantity} WHERE id = ${ci.productId} AND quantity >= ${ci.quantity}`,
      );
      if ((updateResult as any).affectedRows === 0)
        throw new Error(`Insufficient stock for ${prod.name}`);

      const unitPrice = parseFloat(prod.salePrice);
      const lineTotal = unitPrice * ci.quantity;
      subtotal += lineTotal;

      const itemId = randomUUID();
      await tx.insert(onlineStoreOrderItems).values({
        id: itemId,
        orderId,
        productId: ci.productId,
        productName: prod.name,
        productNumber: prod.partNumber,
        quantity: ci.quantity,
        unitPrice: unitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      });

      orderItems.push({
        id: itemId,
        orderId,
        productId: ci.productId,
        productName: prod.name,
        productNumber: prod.partNumber,
        quantity: ci.quantity,
        unitPrice: unitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
        createdAt: new Date(),
      } as OnlineStoreOrderItem);
    }

    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount + parseFloat(deliveryFee);

    await tx.insert(onlineStoreOrders).values({
      id: orderId,
      orderNumber,
      customerId,
      status: "pending_payment",
      deliveryMethod,
      deliveryZoneId: deliveryZoneId || null,
      deliveryFee,
      deliveryAddress: deliveryAddress || null,
      deliveryParish: deliveryParish || null,
      deliveryNotes: deliveryNotes || null,
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
      customerName: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
      customerEmail: customer.email || null,
      customerPhone: customer.phone || null,
    });

    // Clear cart
    await tx
      .delete(shoppingCartItems)
      .where(eq(shoppingCartItems.cartId, cart.id));

    const [order] = await tx
      .select()
      .from(onlineStoreOrders)
      .where(eq(onlineStoreOrders.id, orderId))
      .limit(1);

    return { order, items: orderItems };
  });

  // 7. After transaction: enqueue stock sync events
  const syncItems = result.items.map((item) => ({
    garagePartId: productMap.get(item.productId)?.garagePartId ?? null,
    quantity: item.quantity,
  }));
  await enqueueStockDecrement(
    syncItems,
    orderId,
    result.order.orderNumber,
  );

  return result;
}

// ---------------------------------------------------------------------------
// Payment confirmation
// ---------------------------------------------------------------------------

/**
 * Mark a pending-payment order as paid and placed.
 */
export async function confirmOrderPayment(
  orderId: string,
  paymentTransactionId: string,
): Promise<void> {
  await db
    .update(onlineStoreOrders)
    .set({
      status: "placed",
      paymentStatus: "paid",
      paymentTransactionId,
      placedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(onlineStoreOrders.id, orderId),
        eq(onlineStoreOrders.status, "pending_payment"),
      ),
    );
}

// ---------------------------------------------------------------------------
// Order queries
// ---------------------------------------------------------------------------

/**
 * Fetch a single order by ID with its line items.
 */
export async function getOrder(
  orderId: string,
): Promise<OrderWithItems | null> {
  const [order] = await db
    .select()
    .from(onlineStoreOrders)
    .where(eq(onlineStoreOrders.id, orderId))
    .limit(1);
  if (!order) return null;
  const items = await db
    .select()
    .from(onlineStoreOrderItems)
    .where(eq(onlineStoreOrderItems.orderId, orderId));
  return { ...order, items };
}

/**
 * Fetch a single order by its human-readable order number.
 */
export async function getOrderByNumber(
  orderNumber: string,
): Promise<OrderWithItems | null> {
  const [order] = await db
    .select()
    .from(onlineStoreOrders)
    .where(eq(onlineStoreOrders.orderNumber, orderNumber))
    .limit(1);
  if (!order) return null;
  const items = await db
    .select()
    .from(onlineStoreOrderItems)
    .where(eq(onlineStoreOrderItems.orderId, order.id));
  return { ...order, items };
}

/**
 * Paginated orders for a specific customer (excludes pending_payment).
 */
export async function getOrdersByCustomer(
  customerId: string,
  page = 1,
  limit = 20,
): Promise<{ orders: OnlineStoreOrder[]; total: number }> {
  const offset = (page - 1) * limit;
  const whereClause = and(
    eq(onlineStoreOrders.customerId, customerId),
    sql`${onlineStoreOrders.status} != 'pending_payment'`,
  );
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(onlineStoreOrders)
    .where(whereClause);
  const orders = await db
    .select()
    .from(onlineStoreOrders)
    .where(whereClause)
    .orderBy(desc(onlineStoreOrders.createdAt))
    .limit(limit)
    .offset(offset);
  return { orders, total: countResult?.count || 0 };
}

/**
 * Admin: all orders with optional status/search filters, paginated.
 */
export async function getAllOrders(
  filters: {
    status?: string;
    customerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ orders: OnlineStoreOrder[]; total: number }> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.limit || 20));
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof eq>[] = [];
  if (filters.status)
    conditions.push(eq(onlineStoreOrders.status, filters.status as any));
  if (filters.customerId)
    conditions.push(eq(onlineStoreOrders.customerId, filters.customerId));
  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      sql`(LOWER(${onlineStoreOrders.orderNumber}) LIKE ${term} OR LOWER(${onlineStoreOrders.customerName}) LIKE ${term})` as any,
    );
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(onlineStoreOrders)
    .where(whereClause);
  const orders = await db
    .select()
    .from(onlineStoreOrders)
    .where(whereClause)
    .orderBy(desc(onlineStoreOrders.createdAt))
    .limit(pageSize)
    .offset(offset);
  return { orders, total: countResult?.count || 0 };
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

/**
 * Cancel a pending-payment order: restore stock in DB, update status.
 * Used by the 30-minute cron cleanup and explicit cancel-before-pay flows.
 */
async function cancelPendingOrder(orderId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [result] = await tx.execute(
      sql`UPDATE online_store_orders SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'Payment not completed', updated_at = NOW() WHERE id = ${orderId} AND status = 'pending_payment'`,
    );
    if ((result as any).affectedRows === 0) return;

    const items = await tx
      .select()
      .from(onlineStoreOrderItems)
      .where(eq(onlineStoreOrderItems.orderId, orderId));
    for (const item of items) {
      await tx.execute(
        sql`UPDATE products SET quantity = quantity + ${item.quantity} WHERE id = ${item.productId}`,
      );
    }
  });
}

/**
 * Cancel a placed/confirmed/picking order (staff-initiated).
 * Restores product stock and enqueues sync events for the garage app.
 */
export async function cancelOrder(
  orderId: string,
  reason: string,
  cancelledBy?: string,
): Promise<void> {
  const order = await getOrder(orderId);
  if (!order) throw new Error("Order not found");

  const cancellableStatuses = [
    "pending_payment",
    "placed",
    "confirmed",
    "picking",
  ];
  if (!cancellableStatuses.includes(order.status)) {
    throw new Error(`Cannot cancel order in "${order.status}" status`);
  }

  // For pending_payment, use the simpler path
  if (order.status === "pending_payment") {
    await cancelPendingOrder(orderId);
    // Still enqueue sync restore for pending orders
    const syncItems = await buildSyncItems(order.items);
    await enqueueStockRestore(syncItems, orderId, "order_cancelled");
    return;
  }

  // Restore stock in transaction
  await db.transaction(async (tx) => {
    for (const item of order.items) {
      await tx.execute(
        sql`UPDATE products SET quantity = quantity + ${item.quantity} WHERE id = ${item.productId}`,
      );
    }
    await tx
      .update(onlineStoreOrders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: cancelledBy || null,
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(onlineStoreOrders.id, orderId));
  });

  // Enqueue stock restore sync events
  const syncItems = await buildSyncItems(order.items);
  await enqueueStockRestore(syncItems, orderId, "order_cancelled");
}

// ---------------------------------------------------------------------------
// Fulfillment state transitions
// ---------------------------------------------------------------------------

const validTransitions: Record<string, string[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["picking", "packed", "cancelled"],
  picking: ["packed", "cancelled"],
  packed: ["shipped", "out_for_delivery"],
  shipped: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
};

/**
 * Generic state transition with validation.
 */
async function transitionOrder(
  orderId: string,
  newStatus: OrderStatus,
  updates: Partial<typeof onlineStoreOrders.$inferInsert> = {},
): Promise<void> {
  const [order] = await db
    .select()
    .from(onlineStoreOrders)
    .where(eq(onlineStoreOrders.id, orderId))
    .limit(1);
  if (!order) throw new Error("Order not found");

  const allowed = validTransitions[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Cannot transition from "${order.status}" to "${newStatus}"`,
    );
  }

  await db
    .update(onlineStoreOrders)
    .set({
      status: newStatus,
      updatedAt: new Date(),
      ...updates,
    })
    .where(eq(onlineStoreOrders.id, orderId));
}

/** placed -> confirmed, then auto-create pick list */
export async function confirmOrder(orderId: string): Promise<void> {
  await transitionOrder(orderId, "confirmed", { confirmedAt: new Date() });

  // Auto-create pick list (best-effort — order is still confirmed if this fails)
  try {
    await createPickListForOrder(orderId, "system");
  } catch (error) {
    console.error("Failed to auto-create pick list for order", orderId, error);
  }
}

/** confirmed -> picking */
export async function markOrderPicking(orderId: string): Promise<void> {
  await transitionOrder(orderId, "picking");
}

/** picking -> packed */
export async function markOrderPacked(
  orderId: string,
  packedBy?: string,
): Promise<void> {
  await transitionOrder(orderId, "packed", {
    packedAt: new Date(),
    packedBy: packedBy || null,
  });
}

/** packed -> shipped */
export async function markOrderShipped(
  orderId: string,
  trackingNumber: string,
): Promise<void> {
  await transitionOrder(orderId, "shipped", {
    trackingNumber,
    shippedAt: new Date(),
  });
}

/** shipped -> out_for_delivery */
export async function markOrderOutForDelivery(
  orderId: string,
): Promise<void> {
  await transitionOrder(orderId, "out_for_delivery");
}

/** shipped/out_for_delivery -> delivered */
export async function markOrderDelivered(orderId: string): Promise<void> {
  await transitionOrder(orderId, "delivered", { deliveredAt: new Date() });
}

/** Set pickupReadyAt timestamp (does not change status). */
export async function markOrderReadyForPickup(
  orderId: string,
): Promise<void> {
  await db
    .update(onlineStoreOrders)
    .set({ pickupReadyAt: new Date(), updatedAt: new Date() })
    .where(eq(onlineStoreOrders.id, orderId));
}

/** packed -> delivered (pickup flow) */
export async function markOrderPickedUp(
  orderId: string,
  pickedUpBy: string,
): Promise<void> {
  const [order] = await db
    .select()
    .from(onlineStoreOrders)
    .where(eq(onlineStoreOrders.id, orderId))
    .limit(1);
  if (!order) throw new Error("Order not found");
  if (order.status !== "packed")
    throw new Error("Order must be packed before pickup");
  await db
    .update(onlineStoreOrders)
    .set({
      status: "delivered",
      pickedUpAt: new Date(),
      pickedUpBy,
      deliveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onlineStoreOrders.id, orderId));
}

/** Update staff notes on an order. */
export async function updateOrderNotes(
  orderId: string,
  notes: string,
): Promise<void> {
  await db
    .update(onlineStoreOrders)
    .set({ staffNotes: notes, updatedAt: new Date() })
    .where(eq(onlineStoreOrders.id, orderId));
}

// ---------------------------------------------------------------------------
// Cron cleanup
// ---------------------------------------------------------------------------

/**
 * Cancel orders stuck in pending_payment for > 30 minutes.
 * Restores stock locally and enqueues sync events for each cancelled order.
 * Returns the count of cancelled orders.
 */
export async function cleanupExpiredPendingOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const expired = await db
    .select()
    .from(onlineStoreOrders)
    .where(
      and(
        eq(onlineStoreOrders.status, "pending_payment"),
        sql`${onlineStoreOrders.createdAt} < ${cutoff}`,
      ),
    );

  for (const order of expired) {
    // Restore stock in DB
    await cancelPendingOrder(order.id);

    // Enqueue sync restore for each cancelled order's items
    const items = await db
      .select()
      .from(onlineStoreOrderItems)
      .where(eq(onlineStoreOrderItems.orderId, order.id));
    const syncItems = await buildSyncItems(items);
    await enqueueStockRestore(syncItems, order.id, "order_cancelled");
  }

  return expired.length;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map order items to the shape expected by enqueueStockDecrement / enqueueStockRestore.
 * Looks up each product's garagePartId so the garage app knows which part to adjust.
 */
async function buildSyncItems(
  items: OnlineStoreOrderItem[],
): Promise<Array<{ garagePartId: string | null; quantity: number }>> {
  if (items.length === 0) return [];

  const productIds = items.map((i) => i.productId);
  const productRows = await db
    .select({ id: products.id, garagePartId: products.garagePartId })
    .from(products)
    .where(
      sql`${products.id} IN (${sql.join(
        productIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
  const garageIdMap = new Map(
    productRows.map((p) => [p.id, p.garagePartId]),
  );

  return items.map((item) => ({
    garagePartId: garageIdMap.get(item.productId) ?? null,
    quantity: item.quantity,
  }));
}
