/**
 * Warehouse management storage module.
 * Locations, bins, product bin assignments, stock movements, receipts, and pick support.
 *
 * Invariant: products.quantity = SUM(productBinAssignments.quantity) for that product.
 * All stock-mutating operations maintain this invariant inside transactions.
 */

import { eq, and, sql, desc, asc, count } from "drizzle-orm";
import { db } from "../db.js";
import {
  warehouseLocations,
  warehouseBins,
  productBinAssignments,
  stockMovements,
  stockReceipts,
  stockReceiptItems,
  stockReceiptNumberSequence,
  products,
  type WarehouseLocation,
  type WarehouseBin,
  type Product,
  type StockMovement,
  type StockReceipt,
  type StockReceiptItem,
} from "../schema.js";
import { randomUUID } from "crypto";

// ─── Locations ────────────────────────────────────────────

export async function getLocations(): Promise<WarehouseLocation[]> {
  return db
    .select()
    .from(warehouseLocations)
    .orderBy(asc(warehouseLocations.name));
}

export async function createLocation(data: {
  name: string;
  description?: string;
}): Promise<WarehouseLocation> {
  const id = randomUUID();
  await db.insert(warehouseLocations).values({ id, ...data });
  const [loc] = await db
    .select()
    .from(warehouseLocations)
    .where(eq(warehouseLocations.id, id))
    .limit(1);
  return loc;
}

export async function updateLocation(
  id: string,
  data: Partial<{ name: string; description: string; isActive: boolean }>,
): Promise<void> {
  await db
    .update(warehouseLocations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(warehouseLocations.id, id));
}

// ─── Bins ─────────────────────────────────────────────────

export async function getBins(locationId?: string): Promise<WarehouseBin[]> {
  if (locationId) {
    return db
      .select()
      .from(warehouseBins)
      .where(eq(warehouseBins.locationId, locationId))
      .orderBy(asc(warehouseBins.binCode));
  }
  return db
    .select()
    .from(warehouseBins)
    .orderBy(asc(warehouseBins.binCode));
}

export async function createBin(data: {
  locationId: string;
  binCode: string;
  description?: string;
}): Promise<WarehouseBin> {
  const id = randomUUID();
  await db.insert(warehouseBins).values({ id, ...data });
  const [bin] = await db
    .select()
    .from(warehouseBins)
    .where(eq(warehouseBins.id, id))
    .limit(1);
  return bin;
}

export async function updateBin(
  id: string,
  data: Partial<{ description: string; isActive: boolean }>,
): Promise<void> {
  await db
    .update(warehouseBins)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(warehouseBins.id, id));
}

export async function getBinContents(
  binId: string,
): Promise<Array<{ product: Product; quantity: number }>> {
  const rows = await db
    .select({
      product: products,
      quantity: productBinAssignments.quantity,
    })
    .from(productBinAssignments)
    .innerJoin(products, eq(products.id, productBinAssignments.productId))
    .where(eq(productBinAssignments.binId, binId))
    .orderBy(asc(products.name));
  return rows;
}

// ─── Product Bin Assignments ──────────────────────────────

export async function getProductBinLocations(
  productId: string,
): Promise<Array<{ bin: WarehouseBin; quantity: number }>> {
  const rows = await db
    .select({
      bin: warehouseBins,
      quantity: productBinAssignments.quantity,
    })
    .from(productBinAssignments)
    .innerJoin(warehouseBins, eq(warehouseBins.id, productBinAssignments.binId))
    .where(eq(productBinAssignments.productId, productId))
    .orderBy(asc(warehouseBins.binCode));
  return rows;
}

export async function assignProductToBin(
  productId: string,
  binId: string,
  quantity: number,
  performedBy: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Upsert bin assignment
    const [existing] = await tx
      .select()
      .from(productBinAssignments)
      .where(
        and(
          eq(productBinAssignments.productId, productId),
          eq(productBinAssignments.binId, binId),
        ),
      )
      .limit(1);

    if (existing) {
      await tx
        .update(productBinAssignments)
        .set({
          quantity: existing.quantity + quantity,
          updatedAt: new Date(),
        })
        .where(eq(productBinAssignments.id, existing.id));
    } else {
      await tx.insert(productBinAssignments).values({
        id: randomUUID(),
        productId,
        binId,
        quantity,
      });
    }

    // Update products.quantity
    await tx.execute(
      sql`UPDATE products SET quantity = quantity + ${quantity} WHERE id = ${productId}`,
    );

    // Record stock movement
    await tx.insert(stockMovements).values({
      id: randomUUID(),
      productId,
      binId,
      movementType: "received",
      quantity,
      referenceType: "manual_assignment",
      notes: `Assigned ${quantity} units to bin`,
      performedBy,
    });
  });
}

// ─── Stock Operations ─────────────────────────────────────

export async function transferStock(
  productId: string,
  fromBinId: string,
  toBinId: string,
  quantity: number,
  performedBy: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Decrement source bin (fail if insufficient)
    const [fromAssignment] = await tx
      .select()
      .from(productBinAssignments)
      .where(
        and(
          eq(productBinAssignments.productId, productId),
          eq(productBinAssignments.binId, fromBinId),
        ),
      )
      .limit(1);

    if (!fromAssignment || fromAssignment.quantity < quantity) {
      throw new Error(
        `Insufficient stock in source bin (available: ${fromAssignment?.quantity ?? 0}, requested: ${quantity})`,
      );
    }

    await tx
      .update(productBinAssignments)
      .set({
        quantity: fromAssignment.quantity - quantity,
        updatedAt: new Date(),
      })
      .where(eq(productBinAssignments.id, fromAssignment.id));

    // Increment destination bin (upsert)
    const [toAssignment] = await tx
      .select()
      .from(productBinAssignments)
      .where(
        and(
          eq(productBinAssignments.productId, productId),
          eq(productBinAssignments.binId, toBinId),
        ),
      )
      .limit(1);

    if (toAssignment) {
      await tx
        .update(productBinAssignments)
        .set({
          quantity: toAssignment.quantity + quantity,
          updatedAt: new Date(),
        })
        .where(eq(productBinAssignments.id, toAssignment.id));
    } else {
      await tx.insert(productBinAssignments).values({
        id: randomUUID(),
        productId,
        binId: toBinId,
        quantity,
      });
    }

    // Record two stock movements (products.quantity unchanged for transfers)
    await tx.insert(stockMovements).values([
      {
        id: randomUUID(),
        productId,
        binId: fromBinId,
        movementType: "transferred",
        quantity: -quantity,
        referenceType: "transfer",
        notes: `Transferred out to bin`,
        performedBy,
      },
      {
        id: randomUUID(),
        productId,
        binId: toBinId,
        movementType: "transferred",
        quantity,
        referenceType: "transfer",
        notes: `Transferred in from bin`,
        performedBy,
      },
    ]);
  });
}

export async function adjustStock(
  productId: string,
  binId: string,
  quantity: number,
  reason: string,
  performedBy: string,
): Promise<void> {
  const movementType = quantity >= 0 ? "adjusted_up" : "adjusted_down";

  await db.transaction(async (tx) => {
    // Update bin assignment
    const [existing] = await tx
      .select()
      .from(productBinAssignments)
      .where(
        and(
          eq(productBinAssignments.productId, productId),
          eq(productBinAssignments.binId, binId),
        ),
      )
      .limit(1);

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty < 0) {
        throw new Error(
          `Adjustment would result in negative bin quantity (current: ${existing.quantity}, adjustment: ${quantity})`,
        );
      }
      await tx
        .update(productBinAssignments)
        .set({ quantity: newQty, updatedAt: new Date() })
        .where(eq(productBinAssignments.id, existing.id));
    } else {
      if (quantity < 0) {
        throw new Error(
          `Cannot adjust down: product not assigned to this bin`,
        );
      }
      await tx.insert(productBinAssignments).values({
        id: randomUUID(),
        productId,
        binId,
        quantity,
      });
    }

    // Update products.quantity to match
    await tx.execute(
      sql`UPDATE products SET quantity = quantity + ${quantity} WHERE id = ${productId}`,
    );

    // Record stock movement
    await tx.insert(stockMovements).values({
      id: randomUUID(),
      productId,
      binId,
      movementType,
      quantity,
      referenceType: "adjustment",
      notes: reason,
      performedBy,
    });
  });
}

export async function getStockMovementHistory(
  filters?: {
    productId?: string;
    movementType?: string;
    page?: number;
    limit?: number;
  },
): Promise<{ movements: StockMovement[]; total: number }> {
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (filters?.productId) {
    conditions.push(eq(stockMovements.productId, filters.productId));
  }
  if (filters?.movementType) {
    conditions.push(
      sql`${stockMovements.movementType} = ${filters.movementType}`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [movements, [totalRow]] = await Promise.all([
    db
      .select()
      .from(stockMovements)
      .where(where)
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(stockMovements)
      .where(where),
  ]);

  return { movements, total: totalRow.total };
}

// ─── Stock Receipts ───────────────────────────────────────

export async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();

  // Atomic increment using INSERT ... ON DUPLICATE KEY UPDATE
  await db.execute(
    sql`INSERT INTO stock_receipt_number_sequence (year, last_number) VALUES (${year}, 1)
        ON DUPLICATE KEY UPDATE last_number = last_number + 1`,
  );

  const [row] = await db
    .select()
    .from(stockReceiptNumberSequence)
    .where(eq(stockReceiptNumberSequence.year, year))
    .limit(1);

  const seq = String(row.lastNumber).padStart(4, "0");
  return `RCV-${year}-${seq}`;
}

export async function createStockReceipt(
  data: {
    supplierId?: string;
    notes?: string;
    items: Array<{
      productId: string;
      binId: string;
      quantity: number;
      unitCost?: string;
    }>;
  },
  createdBy: string,
): Promise<StockReceipt> {
  const receiptId = randomUUID();
  const receiptNumber = await generateReceiptNumber();

  await db.transaction(async (tx) => {
    await tx.insert(stockReceipts).values({
      id: receiptId,
      receiptNumber,
      supplierId: data.supplierId,
      status: "draft",
      receivedBy: createdBy,
      notes: data.notes,
    });

    for (const item of data.items) {
      await tx.insert(stockReceiptItems).values({
        id: randomUUID(),
        receiptId,
        productId: item.productId,
        binId: item.binId,
        quantity: item.quantity,
        unitCost: item.unitCost ?? "0.00",
        notes: null,
      });
    }
  });

  const [receipt] = await db
    .select()
    .from(stockReceipts)
    .where(eq(stockReceipts.id, receiptId))
    .limit(1);
  return receipt;
}

export async function getStockReceipts(
  filters?: { status?: string; page?: number; limit?: number },
): Promise<{ receipts: StockReceipt[]; total: number }> {
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 50;
  const offset = (page - 1) * limit;

  const where = filters?.status
    ? sql`${stockReceipts.status} = ${filters.status}`
    : undefined;

  const [receipts, [totalRow]] = await Promise.all([
    db
      .select()
      .from(stockReceipts)
      .where(where)
      .orderBy(desc(stockReceipts.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(stockReceipts)
      .where(where),
  ]);

  return { receipts, total: totalRow.total };
}

export async function getStockReceipt(
  id: string,
): Promise<(StockReceipt & { items: StockReceiptItem[] }) | null> {
  const [receipt] = await db
    .select()
    .from(stockReceipts)
    .where(eq(stockReceipts.id, id))
    .limit(1);

  if (!receipt) return null;

  const items = await db
    .select()
    .from(stockReceiptItems)
    .where(eq(stockReceiptItems.receiptId, id))
    .orderBy(asc(stockReceiptItems.createdAt));

  return { ...receipt, items };
}

export async function confirmStockReceipt(
  receiptId: string,
  receivedBy: string,
): Promise<void> {
  const receipt = await getStockReceipt(receiptId);
  if (!receipt) throw new Error("Stock receipt not found");
  if (receipt.status !== "draft") {
    throw new Error(`Cannot confirm receipt in "${receipt.status}" status`);
  }

  await db.transaction(async (tx) => {
    // Update receipt status
    await tx
      .update(stockReceipts)
      .set({
        status: "received",
        receivedBy,
        updatedAt: new Date(),
      })
      .where(eq(stockReceipts.id, receiptId));

    // Process each item: increment bin assignment + products.quantity, record movement
    for (const item of receipt.items) {
      // Upsert bin assignment
      const [existing] = await tx
        .select()
        .from(productBinAssignments)
        .where(
          and(
            eq(productBinAssignments.productId, item.productId),
            eq(productBinAssignments.binId, item.binId),
          ),
        )
        .limit(1);

      if (existing) {
        await tx
          .update(productBinAssignments)
          .set({
            quantity: existing.quantity + item.quantity,
            updatedAt: new Date(),
          })
          .where(eq(productBinAssignments.id, existing.id));
      } else {
        await tx.insert(productBinAssignments).values({
          id: randomUUID(),
          productId: item.productId,
          binId: item.binId,
          quantity: item.quantity,
        });
      }

      // Update products.quantity
      await tx.execute(
        sql`UPDATE products SET quantity = quantity + ${item.quantity} WHERE id = ${item.productId}`,
      );

      // Record stock movement
      await tx.insert(stockMovements).values({
        id: randomUUID(),
        productId: item.productId,
        binId: item.binId,
        movementType: "received",
        quantity: item.quantity,
        referenceType: "stock_receipt",
        referenceId: receiptId,
        notes: `Received via ${receipt.receiptNumber}`,
        performedBy: receivedBy,
      });
    }
  });
}

export async function cancelStockReceipt(receiptId: string): Promise<void> {
  const [receipt] = await db
    .select()
    .from(stockReceipts)
    .where(eq(stockReceipts.id, receiptId))
    .limit(1);

  if (!receipt) throw new Error("Stock receipt not found");
  if (receipt.status !== "draft") {
    throw new Error(`Cannot cancel receipt in "${receipt.status}" status`);
  }

  await db
    .update(stockReceipts)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(stockReceipts.id, receiptId));
}

// ─── Pick List Support ────────────────────────────────────

export async function selectBinsForPicking(
  productId: string,
  quantity: number,
): Promise<Array<{ binId: string; binCode: string; quantity: number }>> {
  // Get all bins with this product, ordered by quantity descending
  const assignments = await db
    .select({
      binId: productBinAssignments.binId,
      binCode: warehouseBins.binCode,
      available: productBinAssignments.quantity,
    })
    .from(productBinAssignments)
    .innerJoin(warehouseBins, eq(warehouseBins.id, productBinAssignments.binId))
    .where(
      and(
        eq(productBinAssignments.productId, productId),
        sql`${productBinAssignments.quantity} > 0`,
      ),
    )
    .orderBy(desc(productBinAssignments.quantity));

  const totalAvailable = assignments.reduce((sum, a) => sum + a.available, 0);
  if (totalAvailable < quantity) {
    throw new Error(
      `Insufficient stock for picking (available: ${totalAvailable}, requested: ${quantity})`,
    );
  }

  // Prefer exact match first
  const exactMatch = assignments.find((a) => a.available === quantity);
  if (exactMatch) {
    return [
      {
        binId: exactMatch.binId,
        binCode: exactMatch.binCode,
        quantity,
      },
    ];
  }

  // Otherwise pick from largest bins first until fulfilled
  const picks: Array<{ binId: string; binCode: string; quantity: number }> = [];
  let remaining = quantity;

  for (const a of assignments) {
    if (remaining <= 0) break;
    const toPick = Math.min(a.available, remaining);
    picks.push({
      binId: a.binId,
      binCode: a.binCode,
      quantity: toPick,
    });
    remaining -= toPick;
  }

  return picks;
}
