/**
 * Pick list storage module — create pick lists from orders, manage picking workflow.
 *
 * Pick lists bridge orders and warehouse: when an order is confirmed a pick list
 * is generated that tells staff exactly which bins to pull from. Completing a
 * pick list auto-advances the order to "packed".
 */

import { eq, and, sql, desc, asc, count } from "drizzle-orm";
import { db } from "../db.js";
import {
  pickLists,
  pickListItems,
  pickListNumberSequence,
  onlineStoreOrderItems,
  onlineStoreOrders,
  products,
  productBinAssignments,
  stockMovements,
  warehouseBins,
  type PickList,
  type PickListItem,
} from "../schema.js";
import { selectBinsForPicking } from "./warehouse.js";
import { markOrderPacked } from "./orders.js";
import { randomUUID } from "crypto";

// ─── Number Generation ───────────────────────────────────

/**
 * Atomically generate the next pick list number for the current year.
 * Format: PL-YYYY-NNNN (zero-padded to 4 digits).
 */
export async function generatePickListNumber(): Promise<string> {
  const year = new Date().getFullYear();

  await db.execute(
    sql`INSERT INTO pick_list_number_sequence (year, last_number) VALUES (${year}, 1)
        ON DUPLICATE KEY UPDATE last_number = last_number + 1`,
  );

  const [row] = await db
    .select()
    .from(pickListNumberSequence)
    .where(eq(pickListNumberSequence.year, year))
    .limit(1);

  const seq = String(row.lastNumber).padStart(4, "0");
  return `PL-${year}-${seq}`;
}

// ─── Create ──────────────────────────────────────────────

/**
 * Create a pick list for an online order.
 *
 * 1. Fetches order items
 * 2. For each item, calls selectBinsForPicking() to determine which bins to pull from
 * 3. Generates a pick list number
 * 4. Inserts the pick list and its items
 * 5. Links the pick list to the order
 */
export async function createPickListForOrder(
  orderId: string,
  createdBy: string,
): Promise<PickList & { items: PickListItem[] }> {
  // 1. Get order items
  const orderItems = await db
    .select()
    .from(onlineStoreOrderItems)
    .where(eq(onlineStoreOrderItems.orderId, orderId));

  if (orderItems.length === 0) {
    throw new Error("Order has no items");
  }

  // 2. Determine bin picks for each item
  const itemPicks: Array<{
    productId: string;
    binId: string;
    binCode: string;
    quantityRequired: number;
  }> = [];

  for (const orderItem of orderItems) {
    const bins = await selectBinsForPicking(
      orderItem.productId,
      orderItem.quantity,
    );
    for (const bin of bins) {
      itemPicks.push({
        productId: orderItem.productId,
        binId: bin.binId,
        binCode: bin.binCode,
        quantityRequired: bin.quantity,
      });
    }
  }

  // 3. Generate pick list number
  const pickListNumber = await generatePickListNumber();
  const pickListId = randomUUID();

  // 4. Insert pick list and items
  const insertedItems: PickListItem[] = [];

  await db.transaction(async (tx) => {
    await tx.insert(pickLists).values({
      id: pickListId,
      pickListNumber,
      sourceType: "online_order",
      sourceId: orderId,
      status: "pending",
      createdBy,
    });

    for (const pick of itemPicks) {
      const itemId = randomUUID();
      await tx.insert(pickListItems).values({
        id: itemId,
        pickListId,
        productId: pick.productId,
        binId: pick.binId,
        quantityRequired: pick.quantityRequired,
        quantityPicked: 0,
        status: "pending",
      });

      insertedItems.push({
        id: itemId,
        pickListId,
        productId: pick.productId,
        binId: pick.binId,
        quantityRequired: pick.quantityRequired,
        quantityPicked: 0,
        status: "pending",
        pickedAt: null,
        notes: null,
        createdAt: new Date(),
      });
    }

    // 5. Link pick list to order
    await tx
      .update(onlineStoreOrders)
      .set({ pickListId, updatedAt: new Date() })
      .where(eq(onlineStoreOrders.id, orderId));
  });

  const [pickList] = await db
    .select()
    .from(pickLists)
    .where(eq(pickLists.id, pickListId))
    .limit(1);

  return { ...pickList, items: insertedItems };
}

// ─── Queries ─────────────────────────────────────────────

/**
 * Paginated list of pick lists with optional status filter.
 */
export async function getPickLists(
  filters?: { status?: string; page?: number; limit?: number },
): Promise<{ pickLists: PickList[]; total: number }> {
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 50;
  const offset = (page - 1) * limit;

  const where = filters?.status
    ? sql`${pickLists.status} = ${filters.status}`
    : undefined;

  const [lists, [totalRow]] = await Promise.all([
    db
      .select()
      .from(pickLists)
      .where(where)
      .orderBy(desc(pickLists.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(pickLists)
      .where(where),
  ]);

  return { pickLists: lists, total: totalRow.total };
}

/**
 * Single pick list with items, including bin codes and product names.
 */
export async function getPickList(
  id: string,
): Promise<
  | (PickList & {
      items: Array<
        PickListItem & { binCode: string; productName: string }
      >;
    })
  | null
> {
  const [pickList] = await db
    .select()
    .from(pickLists)
    .where(eq(pickLists.id, id))
    .limit(1);

  if (!pickList) return null;

  const items = await db
    .select({
      id: pickListItems.id,
      pickListId: pickListItems.pickListId,
      productId: pickListItems.productId,
      binId: pickListItems.binId,
      quantityRequired: pickListItems.quantityRequired,
      quantityPicked: pickListItems.quantityPicked,
      status: pickListItems.status,
      pickedAt: pickListItems.pickedAt,
      notes: pickListItems.notes,
      createdAt: pickListItems.createdAt,
      binCode: warehouseBins.binCode,
      productName: sql<string>`${products.name}`.as("productName"),
    })
    .from(pickListItems)
    .innerJoin(warehouseBins, eq(warehouseBins.id, pickListItems.binId))
    .innerJoin(products, eq(products.id, pickListItems.productId))
    .where(eq(pickListItems.pickListId, id))
    .orderBy(asc(warehouseBins.binCode));

  return { ...pickList, items };
}

// ─── State Transitions ───────────────────────────────────

/**
 * Assign a pick list to a staff member. pending -> assigned.
 */
export async function assignPickList(
  id: string,
  assignedTo: string,
): Promise<void> {
  const [pickList] = await db
    .select()
    .from(pickLists)
    .where(eq(pickLists.id, id))
    .limit(1);

  if (!pickList) throw new Error("Pick list not found");
  if (pickList.status !== "pending") {
    throw new Error(`Cannot assign pick list in "${pickList.status}" status`);
  }

  await db
    .update(pickLists)
    .set({ status: "assigned", assignedTo, assignedAt: new Date() })
    .where(eq(pickLists.id, id));
}

/**
 * Start picking. assigned -> in_progress.
 */
export async function startPickList(id: string): Promise<void> {
  const [pickList] = await db
    .select()
    .from(pickLists)
    .where(eq(pickLists.id, id))
    .limit(1);

  if (!pickList) throw new Error("Pick list not found");
  if (pickList.status !== "assigned") {
    throw new Error(`Cannot start pick list in "${pickList.status}" status`);
  }

  await db
    .update(pickLists)
    .set({ status: "in_progress", startedAt: new Date() })
    .where(eq(pickLists.id, id));
}

/**
 * Record a pick for a single item.
 * Sets status to "picked" if quantityPicked >= quantityRequired, or "short" if less.
 */
export async function pickItem(
  pickListItemId: string,
  quantityPicked: number,
): Promise<void> {
  const [item] = await db
    .select()
    .from(pickListItems)
    .where(eq(pickListItems.id, pickListItemId))
    .limit(1);

  if (!item) throw new Error("Pick list item not found");
  if (item.status === "picked" || item.status === "skipped") {
    throw new Error(`Item already in "${item.status}" status`);
  }

  const newStatus =
    quantityPicked >= item.quantityRequired ? "picked" : "short";

  await db
    .update(pickListItems)
    .set({
      quantityPicked,
      status: newStatus,
      pickedAt: new Date(),
    })
    .where(eq(pickListItems.id, pickListItemId));
}

/**
 * Complete a pick list.
 * 1. Verifies all items are picked/short/skipped (none pending)
 * 2. Sets status -> completed, completedAt
 * 3. If sourceType === "online_order": auto-advance the order to packed
 */
export async function completePickList(id: string): Promise<void> {
  const [pickList] = await db
    .select()
    .from(pickLists)
    .where(eq(pickLists.id, id))
    .limit(1);

  if (!pickList) throw new Error("Pick list not found");
  if (pickList.status !== "in_progress") {
    throw new Error(
      `Cannot complete pick list in "${pickList.status}" status`,
    );
  }

  // Verify all items are resolved
  const [pendingRow] = await db
    .select({ total: count() })
    .from(pickListItems)
    .where(
      and(
        eq(pickListItems.pickListId, id),
        eq(pickListItems.status, "pending"),
      ),
    );

  if (pendingRow.total > 0) {
    throw new Error(
      `Cannot complete: ${pendingRow.total} item(s) still pending`,
    );
  }

  // W9: For short or skipped items, restore the unpicked reserved stock back to bins.
  // Since stock was reserved at order placement (W8), pick completion should NOT
  // double-deduct. Instead, we restore the difference for items that were short-picked.
  const allItems = await db
    .select()
    .from(pickListItems)
    .where(eq(pickListItems.pickListId, id));

  await db.transaction(async (tx) => {
    for (const item of allItems) {
      const shortfall = item.quantityRequired - item.quantityPicked;
      if (shortfall > 0) {
        // Restore unpicked quantity back to bin assignment
        await tx.execute(
          sql`UPDATE product_bin_assignments SET quantity = quantity + ${shortfall}, updated_at = NOW() WHERE product_id = ${item.productId} AND bin_id = ${item.binId}`,
        );

        // Restore to products.quantity
        await tx.execute(
          sql`UPDATE products SET quantity = quantity + ${shortfall} WHERE id = ${item.productId}`,
        );

        // Write unreserved movement
        await tx.insert(stockMovements).values({
          id: randomUUID(),
          productId: item.productId,
          binId: item.binId,
          movementType: "unreserved",
          quantity: shortfall,
          referenceType: "pick_list",
          referenceId: id,
          notes: `Short pick: required ${item.quantityRequired}, picked ${item.quantityPicked}`,
          performedBy: "system",
        });
      }
    }

    await tx
      .update(pickLists)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(pickLists.id, id));
  });

  // Auto-advance order to packed
  if (pickList.sourceType === "online_order") {
    try {
      await markOrderPacked(pickList.sourceId);
    } catch (error) {
      // Best-effort: order may have been cancelled or already advanced
      console.error(
        "Failed to auto-pack order after pick list completion",
        pickList.sourceId,
        error,
      );
    }
  }
}

/**
 * Skip a pick list item. Sets status to "skipped" with quantityPicked = 0.
 */
export async function skipItem(
  pickListId: string,
  itemId: string,
): Promise<void> {
  const [item] = await db
    .select()
    .from(pickListItems)
    .where(
      and(
        eq(pickListItems.id, itemId),
        eq(pickListItems.pickListId, pickListId),
      ),
    )
    .limit(1);

  if (!item) throw new Error("Pick list item not found");
  if (item.status === "picked" || item.status === "skipped") {
    throw new Error(`Item already in "${item.status}" status`);
  }

  await db
    .update(pickListItems)
    .set({
      quantityPicked: 0,
      status: "skipped",
      pickedAt: new Date(),
    })
    .where(eq(pickListItems.id, itemId));
}

/**
 * Cancel a pick list. Allowed from pending, assigned, or in_progress status.
 */
export async function cancelPickList(id: string): Promise<void> {
  const [pickList] = await db
    .select()
    .from(pickLists)
    .where(eq(pickLists.id, id))
    .limit(1);

  if (!pickList) throw new Error("Pick list not found");

  const cancellableStatuses = ["pending", "assigned", "in_progress"];
  if (!cancellableStatuses.includes(pickList.status)) {
    throw new Error(
      `Cannot cancel pick list in "${pickList.status}" status`,
    );
  }

  await db
    .update(pickLists)
    .set({ status: "cancelled" })
    .where(eq(pickLists.id, id));
}
