/**
 * Cycle count storage module — create, record, and complete inventory cycle counts.
 */

import { eq, and, sql, desc, count } from "drizzle-orm";
import { db } from "../db.js";
import {
  cycleCounts,
  cycleCountItems,
  productBinAssignments,
  warehouseBins,
  products,
  stockMovements,
  type CycleCount,
  type CycleCountItem,
} from "../schema.js";
import { randomUUID } from "crypto";

/**
 * Create a cycle count for a location. Populates items from all product/bin
 * combos in that location's bins.
 */
export async function createCycleCount(
  locationId: string,
  startedBy: string,
): Promise<CycleCount & { items: CycleCountItem[] }> {
  const id = randomUUID();

  // Get all product/bin assignments in this location
  const assignments = await db
    .select({
      productId: productBinAssignments.productId,
      binId: productBinAssignments.binId,
      quantity: productBinAssignments.quantity,
    })
    .from(productBinAssignments)
    .innerJoin(warehouseBins, eq(warehouseBins.id, productBinAssignments.binId))
    .where(eq(warehouseBins.locationId, locationId));

  if (assignments.length === 0) {
    throw new Error("No products found in bins at this location");
  }

  const items: CycleCountItem[] = [];

  await db.transaction(async (tx) => {
    await tx.insert(cycleCounts).values({
      id,
      locationId,
      status: "pending",
      startedBy,
    });

    for (const assignment of assignments) {
      const itemId = randomUUID();
      await tx.insert(cycleCountItems).values({
        id: itemId,
        cycleCountId: id,
        productId: assignment.productId,
        binId: assignment.binId,
        expectedQuantity: assignment.quantity,
        status: "pending",
      });
      items.push({
        id: itemId,
        cycleCountId: id,
        productId: assignment.productId,
        binId: assignment.binId,
        expectedQuantity: assignment.quantity,
        actualQuantity: null,
        variance: null,
        status: "pending",
        countedAt: null,
      });
    }
  });

  const [cycleCount] = await db
    .select()
    .from(cycleCounts)
    .where(eq(cycleCounts.id, id))
    .limit(1);

  return { ...cycleCount, items };
}

/**
 * List cycle counts with optional status filter, including item counts.
 */
export async function getCycleCounts(
  status?: string,
): Promise<Array<CycleCount & { itemCount: number }>> {
  const where = status
    ? sql`${cycleCounts.status} = ${status}`
    : undefined;

  const rows = await db
    .select({
      cycleCount: cycleCounts,
      itemCount: count(cycleCountItems.id),
    })
    .from(cycleCounts)
    .leftJoin(cycleCountItems, eq(cycleCountItems.cycleCountId, cycleCounts.id))
    .where(where)
    .groupBy(cycleCounts.id)
    .orderBy(desc(cycleCounts.createdAt));

  return rows.map((r) => ({
    ...r.cycleCount,
    itemCount: r.itemCount,
  }));
}

/**
 * Get a single cycle count with all items (including product names and bin codes).
 */
export async function getCycleCount(
  id: string,
): Promise<
  | (CycleCount & {
      items: Array<CycleCountItem & { productName: string; binCode: string }>;
    })
  | null
> {
  const [cycleCount] = await db
    .select()
    .from(cycleCounts)
    .where(eq(cycleCounts.id, id))
    .limit(1);

  if (!cycleCount) return null;

  const items = await db
    .select({
      id: cycleCountItems.id,
      cycleCountId: cycleCountItems.cycleCountId,
      productId: cycleCountItems.productId,
      binId: cycleCountItems.binId,
      expectedQuantity: cycleCountItems.expectedQuantity,
      actualQuantity: cycleCountItems.actualQuantity,
      variance: cycleCountItems.variance,
      status: cycleCountItems.status,
      countedAt: cycleCountItems.countedAt,
      productName: sql<string>`${products.name}`.as("productName"),
      binCode: warehouseBins.binCode,
    })
    .from(cycleCountItems)
    .innerJoin(products, eq(products.id, cycleCountItems.productId))
    .innerJoin(warehouseBins, eq(warehouseBins.id, cycleCountItems.binId))
    .where(eq(cycleCountItems.cycleCountId, id));

  return { ...cycleCount, items };
}

/**
 * Record a count for a single item. Sets actual quantity and calculates variance.
 */
export async function recordCount(
  itemId: string,
  actualQuantity: number,
): Promise<void> {
  const [item] = await db
    .select()
    .from(cycleCountItems)
    .where(eq(cycleCountItems.id, itemId))
    .limit(1);

  if (!item) throw new Error("Cycle count item not found");
  if (item.status === "counted") {
    throw new Error("Item already counted");
  }

  const variance = actualQuantity - item.expectedQuantity;

  await db
    .update(cycleCountItems)
    .set({
      actualQuantity,
      variance,
      status: "counted",
      countedAt: new Date(),
    })
    .where(eq(cycleCountItems.id, itemId));
}

/**
 * Complete a cycle count: apply all variances as stock adjustments.
 * For each item with a non-zero variance, adjusts product_bin_assignments
 * and products.quantity, and writes a stock_movement.
 */
export async function completeCycleCount(id: string): Promise<void> {
  const [cycleCount] = await db
    .select()
    .from(cycleCounts)
    .where(eq(cycleCounts.id, id))
    .limit(1);

  if (!cycleCount) throw new Error("Cycle count not found");
  if (cycleCount.status === "completed") {
    throw new Error("Cycle count already completed");
  }
  if (cycleCount.status === "cancelled") {
    throw new Error("Cycle count is cancelled");
  }

  // Get all items
  const items = await db
    .select()
    .from(cycleCountItems)
    .where(eq(cycleCountItems.cycleCountId, id));

  // Check that all items are counted or skipped
  const pendingItems = items.filter((i) => i.status === "pending");
  if (pendingItems.length > 0) {
    throw new Error(
      `Cannot complete: ${pendingItems.length} item(s) still pending`,
    );
  }

  await db.transaction(async (tx) => {
    // Apply variances for counted items with non-zero variance
    for (const item of items) {
      if (item.status !== "counted" || !item.variance || item.variance === 0) {
        continue;
      }

      const variance = item.variance;

      // Update bin assignment to actual quantity
      await tx
        .update(productBinAssignments)
        .set({
          quantity: item.actualQuantity!,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productBinAssignments.productId, item.productId!),
            eq(productBinAssignments.binId, item.binId!),
          ),
        );

      // Update products.quantity by the variance
      await tx.execute(
        sql`UPDATE products SET quantity = quantity + ${variance} WHERE id = ${item.productId}`,
      );

      // Record stock movement
      const movementType = variance > 0 ? "adjusted_up" : "adjusted_down";
      await tx.insert(stockMovements).values({
        id: randomUUID(),
        productId: item.productId!,
        binId: item.binId,
        movementType,
        quantity: variance,
        referenceType: "cycle_count",
        referenceId: id,
        notes: `Cycle count adjustment (expected: ${item.expectedQuantity}, actual: ${item.actualQuantity})`,
        performedBy: cycleCount.startedBy,
      });
    }

    // Mark cycle count as completed
    await tx
      .update(cycleCounts)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(cycleCounts.id, id));
  });
}
