/**
 * POS (Point of Sale) storage module.
 * Sessions, sales, voids, refunds, held carts, product lookup, and reporting.
 *
 * All stock-mutating operations use atomic SQL (WHERE quantity >= N) inside
 * transactions. After commit, sync events are enqueued so the garage app
 * reflects the change.
 */

import { eq, and, sql, desc, asc, gte, lt } from "drizzle-orm";
import { db } from "../db.js";
import {
  posSessions,
  posTransactions,
  posTransactionItems,
  posHeldCarts,
  posTransactionNumberSequence,
  posSessionNumberSequence,
  products,
  storeSettings,
  type PosSession,
  type PosTransaction,
  type PosTransactionItem,
  type PosHeldCart,
  type Product,
} from "../schema.js";
import {
  enqueueStockDecrement,
  enqueueStockRestore,
} from "../sync/stockSync.js";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransactionWithItems = PosTransaction & {
  items: PosTransactionItem[];
};

export interface DailyReport {
  date: string;
  totalSales: number;
  transactionCount: number;
  voidCount: number;
  refundCount: number;
  refundTotal: number;
  paymentBreakdown: Record<string, { count: number; total: number }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    productNumber: string;
    quantitySold: number;
    revenue: number;
  }>;
}

export interface SessionReport {
  session: PosSession;
  salesTotal: number;
  transactionCount: number;
  voidCount: number;
  refundCount: number;
  refundTotal: number;
  paymentBreakdown: Record<string, { count: number; total: number }>;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashDifference: number | null;
}

// ---------------------------------------------------------------------------
// Session number generation
// ---------------------------------------------------------------------------

/**
 * Atomically generate the next session number for the current year.
 * Format: SES-YYYY-NNNN (zero-padded to 4 digits).
 */
export async function generateSessionNumber(): Promise<string> {
  const year = new Date().getFullYear();
  return db.transaction(async (tx) => {
    const [rows] = await tx.execute(
      sql.raw(
        `SELECT * FROM \`pos_session_number_sequence\` WHERE year = ${year} FOR UPDATE`,
      ),
    );
    const seq = Array.isArray(rows) ? (rows[0] as any) : (rows as any);
    if (!seq) {
      await tx.execute(
        sql.raw(
          `INSERT INTO \`pos_session_number_sequence\` (year, last_number) VALUES (${year}, 1)`,
        ),
      );
      return `SES-${year}-0001`;
    }
    const nextNum = (seq.last_number || 0) + 1;
    await tx.execute(
      sql.raw(
        `UPDATE \`pos_session_number_sequence\` SET last_number = ${nextNum} WHERE year = ${year}`,
      ),
    );
    return `SES-${year}-${String(nextNum).padStart(4, "0")}`;
  });
}

// ---------------------------------------------------------------------------
// Transaction number generation
// ---------------------------------------------------------------------------

/**
 * Atomically generate the next transaction number for the current year.
 * Format: POS-YYYY-NNNN (zero-padded to 4 digits).
 */
export async function generateTransactionNumber(): Promise<string> {
  const year = new Date().getFullYear();
  return db.transaction(async (tx) => {
    const [rows] = await tx.execute(
      sql.raw(
        `SELECT * FROM \`pos_transaction_number_sequence\` WHERE year = ${year} FOR UPDATE`,
      ),
    );
    const seq = Array.isArray(rows) ? (rows[0] as any) : (rows as any);
    if (!seq) {
      await tx.execute(
        sql.raw(
          `INSERT INTO \`pos_transaction_number_sequence\` (year, last_number) VALUES (${year}, 1)`,
        ),
      );
      return `POS-${year}-0001`;
    }
    const nextNum = (seq.last_number || 0) + 1;
    await tx.execute(
      sql.raw(
        `UPDATE \`pos_transaction_number_sequence\` SET last_number = ${nextNum} WHERE year = ${year}`,
      ),
    );
    return `POS-${year}-${String(nextNum).padStart(4, "0")}`;
  });
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/** Open a new POS session. Throws if one is already open. */
export async function openSession(
  openedBy: string,
  openingCash: string,
): Promise<PosSession> {
  const existing = await getCurrentSession();
  if (existing) {
    throw new Error("A POS session is already open. Close it before opening a new one.");
  }

  const sessionNumber = await generateSessionNumber();
  const id = randomUUID();

  await db.insert(posSessions).values({
    id,
    sessionNumber,
    openedBy,
    openingCash,
    status: "open",
  });

  const [session] = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.id, id))
    .limit(1);

  return session;
}

/** Get the currently open session, or null if none. */
export async function getCurrentSession(): Promise<PosSession | null> {
  const [session] = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.status, "open"))
    .limit(1);
  return session ?? null;
}

/** Get a session by ID. */
export async function getSession(sessionId: string): Promise<PosSession | null> {
  const [session] = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.id, sessionId))
    .limit(1);
  return session ?? null;
}

/**
 * Close the session.
 * Calculates expectedCash = openingCash + cash sales - cash refunds.
 * cashDifference = closingCash - expectedCash.
 */
export async function closeSession(
  sessionId: string,
  closedBy: string,
  closingCash: string,
  notes?: string,
): Promise<PosSession> {
  const [session] = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.id, sessionId))
    .limit(1);

  if (!session) throw new Error("Session not found");
  if (session.status !== "open") throw new Error("Session is already closed");

  // Sum cash sales (completed, payment_method = cash)
  const [cashSalesResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${posTransactions.total}), 0)`,
    })
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.sessionId, sessionId),
        eq(posTransactions.type, "sale"),
        eq(posTransactions.status, "completed"),
        eq(posTransactions.paymentMethod, "cash"),
      ),
    );

  // Sum cash refunds
  const [cashRefundsResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${posTransactions.total}), 0)`,
    })
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.sessionId, sessionId),
        eq(posTransactions.type, "refund"),
        eq(posTransactions.status, "completed"),
        eq(posTransactions.paymentMethod, "cash"),
      ),
    );

  const openingCashNum = parseFloat(session.openingCash);
  const cashSales = parseFloat(cashSalesResult.total);
  const cashRefunds = parseFloat(cashRefundsResult.total);
  const expectedCash = openingCashNum + cashSales - cashRefunds;
  const closingCashNum = parseFloat(closingCash);
  const cashDifference = closingCashNum - expectedCash;

  await db
    .update(posSessions)
    .set({
      closedBy,
      closedAt: new Date(),
      closingCash,
      expectedCash: expectedCash.toFixed(2),
      cashDifference: cashDifference.toFixed(2),
      status: "closed",
      notes: notes ?? null,
    })
    .where(eq(posSessions.id, sessionId));

  const [updated] = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.id, sessionId))
    .limit(1);

  return updated;
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

/**
 * Create a POS sale transaction.
 *
 * 1. Verify session is open
 * 2. Look up each product, calculate line totals with discounts
 * 3. Get tax rate from storeSettings
 * 4. In transaction: generate number, decrement stock, insert transaction + items
 * 5. After commit: enqueue stock sync events
 */
export async function createSale(params: {
  sessionId: string;
  items: Array<{
    productId: string;
    quantity: number;
    discountPercent?: number;
  }>;
  paymentMethod: "cash" | "card" | "saved_card" | "split";
  cashReceived?: string;
  customerId?: string;
  processedBy: string;
}): Promise<TransactionWithItems> {
  const { sessionId, items, paymentMethod, cashReceived, customerId, processedBy } =
    params;

  // 1. Verify session
  const [session] = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.id, sessionId))
    .limit(1);
  if (!session) throw new Error("Session not found");
  if (session.status !== "open") throw new Error("Session is not open");

  if (items.length === 0) throw new Error("No items in sale");

  // 2. Look up products
  const productIds = items.map((i) => i.productId);
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

  // Validate all products exist and have sufficient stock
  for (const item of items) {
    const prod = productMap.get(item.productId);
    if (!prod) throw new Error(`Product not found: ${item.productId}`);
    if (prod.quantity < item.quantity)
      throw new Error(`Insufficient stock for ${prod.name}`);
  }

  // 3. Tax rate
  const [settings] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.id, 1))
    .limit(1);
  const taxRate = settings ? parseFloat(settings.taxRate) : 0;

  // 4. Transaction
  const transactionId = randomUUID();

  const result = await db.transaction(async (tx) => {
    const transactionNumber = await generateTransactionNumber();
    const txItems: PosTransactionItem[] = [];
    let subtotal = 0;
    let totalDiscount = 0;

    for (const item of items) {
      const prod = productMap.get(item.productId)!;

      // Atomic stock decrement
      const [updateResult] = await tx.execute(
        sql`UPDATE products SET quantity = quantity - ${item.quantity} WHERE id = ${item.productId} AND quantity >= ${item.quantity}`,
      );
      if ((updateResult as any).affectedRows === 0)
        throw new Error(`Insufficient stock for ${prod.name}`);

      const unitPrice = parseFloat(prod.salePrice);
      const lineGross = unitPrice * item.quantity;
      const discountPercent = item.discountPercent ?? 0;
      const discountAmount = lineGross * (discountPercent / 100);
      const lineTotal = lineGross - discountAmount;

      subtotal += lineGross;
      totalDiscount += discountAmount;

      const itemId = randomUUID();
      await tx.insert(posTransactionItems).values({
        id: itemId,
        transactionId,
        productId: item.productId,
        productName: prod.name,
        productNumber: prod.partNumber,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        discountPercent: discountPercent.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      });

      txItems.push({
        id: itemId,
        transactionId,
        productId: item.productId,
        productName: prod.name,
        productNumber: prod.partNumber,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        discountPercent: discountPercent.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
        createdAt: new Date(),
      } as PosTransactionItem);
    }

    const taxableSubtotal = subtotal - totalDiscount;
    const taxAmount = taxableSubtotal * (taxRate / 100);
    const total = taxableSubtotal + taxAmount;

    let changeGiven: string | null = null;
    if (paymentMethod === "cash" && cashReceived) {
      const received = parseFloat(cashReceived);
      changeGiven = (received - total).toFixed(2);
    }

    await tx.insert(posTransactions).values({
      id: transactionId,
      transactionNumber,
      sessionId,
      customerId: customerId ?? null,
      type: "sale",
      status: "completed",
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      discountAmount: totalDiscount.toFixed(2),
      total: total.toFixed(2),
      paymentMethod,
      cashReceived: cashReceived ?? null,
      changeGiven,
      processedBy,
    });

    const [txn] = await tx
      .select()
      .from(posTransactions)
      .where(eq(posTransactions.id, transactionId))
      .limit(1);

    return { transaction: txn, items: txItems };
  });

  // 5. After commit: enqueue stock sync
  const syncItems = result.items.map((item) => ({
    garagePartId: productMap.get(item.productId)?.garagePartId ?? null,
    quantity: item.quantity,
  }));
  await enqueueStockDecrement(syncItems, transactionId, result.transaction.transactionNumber);

  return { ...result.transaction, items: result.items };
}

// ---------------------------------------------------------------------------
// Void
// ---------------------------------------------------------------------------

/**
 * Void a completed transaction.
 * Restores product stock and marks the transaction as voided.
 * Session must still be open.
 */
export async function voidTransaction(
  transactionId: string,
  voidedBy: string,
  voidReason: string,
): Promise<void> {
  // Load transaction + items
  const [txn] = await db
    .select()
    .from(posTransactions)
    .where(eq(posTransactions.id, transactionId))
    .limit(1);
  if (!txn) throw new Error("Transaction not found");
  if (txn.status !== "completed")
    throw new Error("Only completed transactions can be voided");

  // Verify session is still open
  const [session] = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.id, txn.sessionId))
    .limit(1);
  if (!session || session.status !== "open")
    throw new Error("Cannot void: session is closed");

  const txnItems = await db
    .select()
    .from(posTransactionItems)
    .where(eq(posTransactionItems.transactionId, transactionId));

  // Transaction: restore stock, update status
  await db.transaction(async (tx) => {
    for (const item of txnItems) {
      await tx.execute(
        sql`UPDATE products SET quantity = quantity + ${item.quantity} WHERE id = ${item.productId}`,
      );
    }

    await tx
      .update(posTransactions)
      .set({
        status: "voided",
        voidedBy,
        voidReason,
      })
      .where(eq(posTransactions.id, transactionId));
  });

  // After commit: enqueue stock restore
  const productIds = txnItems.map((i) => i.productId);
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

  const syncItems = txnItems.map((item) => ({
    garagePartId: productMap.get(item.productId)?.garagePartId ?? null,
    quantity: item.quantity,
  }));
  await enqueueStockRestore(syncItems, transactionId, voidReason);
}

// ---------------------------------------------------------------------------
// Refund
// ---------------------------------------------------------------------------

/**
 * Refund specific items from a completed transaction.
 * Creates a new "refund" type transaction linked to the original.
 * Restores product stock for refunded items.
 */
export async function refundTransaction(
  originalTransactionId: string,
  items: Array<{ transactionItemId: string; quantity: number }>,
  processedBy: string,
): Promise<TransactionWithItems> {
  // Load original transaction
  const [originalTxn] = await db
    .select()
    .from(posTransactions)
    .where(eq(posTransactions.id, originalTransactionId))
    .limit(1);
  if (!originalTxn) throw new Error("Original transaction not found");
  if (originalTxn.status !== "completed")
    throw new Error("Only completed transactions can be refunded");

  // Load original items
  const originalItems = await db
    .select()
    .from(posTransactionItems)
    .where(eq(posTransactionItems.transactionId, originalTransactionId));
  const originalItemMap = new Map(originalItems.map((i) => [i.id, i]));

  // Validate refund items
  for (const refundItem of items) {
    const origItem = originalItemMap.get(refundItem.transactionItemId);
    if (!origItem)
      throw new Error(`Transaction item not found: ${refundItem.transactionItemId}`);
    if (refundItem.quantity <= 0)
      throw new Error("Refund quantity must be positive");
    if (refundItem.quantity > origItem.quantity)
      throw new Error(
        `Refund quantity (${refundItem.quantity}) exceeds original quantity (${origItem.quantity}) for ${origItem.productName}`,
      );
  }

  // Get tax rate for refund calculation
  const [settings] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.id, 1))
    .limit(1);
  const taxRate = settings ? parseFloat(settings.taxRate) : 0;

  const refundId = randomUUID();

  const result = await db.transaction(async (tx) => {
    const transactionNumber = await generateTransactionNumber();
    const refundTxItems: PosTransactionItem[] = [];
    let subtotal = 0;
    let totalDiscount = 0;

    for (const refundItem of items) {
      const origItem = originalItemMap.get(refundItem.transactionItemId)!;

      // Restore stock
      await tx.execute(
        sql`UPDATE products SET quantity = quantity + ${refundItem.quantity} WHERE id = ${origItem.productId}`,
      );

      const unitPrice = parseFloat(origItem.unitPrice);
      const lineGross = unitPrice * refundItem.quantity;
      // Proportional discount from original item
      const origDiscountPercent = parseFloat(origItem.discountPercent);
      const discountAmount = lineGross * (origDiscountPercent / 100);
      const lineTotal = lineGross - discountAmount;

      subtotal += lineGross;
      totalDiscount += discountAmount;

      const itemId = randomUUID();
      await tx.insert(posTransactionItems).values({
        id: itemId,
        transactionId: refundId,
        productId: origItem.productId,
        productName: origItem.productName,
        productNumber: origItem.productNumber,
        quantity: refundItem.quantity,
        unitPrice: origItem.unitPrice,
        discountPercent: origItem.discountPercent,
        discountAmount: discountAmount.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      });

      refundTxItems.push({
        id: itemId,
        transactionId: refundId,
        productId: origItem.productId,
        productName: origItem.productName,
        productNumber: origItem.productNumber,
        quantity: refundItem.quantity,
        unitPrice: origItem.unitPrice,
        discountPercent: origItem.discountPercent,
        discountAmount: discountAmount.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
        createdAt: new Date(),
      } as PosTransactionItem);
    }

    const taxableSubtotal = subtotal - totalDiscount;
    const taxAmount = taxableSubtotal * (taxRate / 100);
    const total = taxableSubtotal + taxAmount;

    await tx.insert(posTransactions).values({
      id: refundId,
      transactionNumber,
      sessionId: originalTxn.sessionId,
      customerId: originalTxn.customerId,
      type: "refund",
      status: "completed",
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      discountAmount: totalDiscount.toFixed(2),
      total: total.toFixed(2),
      paymentMethod: originalTxn.paymentMethod,
      processedBy,
      originalTransactionId,
    });

    const [refundTxn] = await tx
      .select()
      .from(posTransactions)
      .where(eq(posTransactions.id, refundId))
      .limit(1);

    return { transaction: refundTxn, items: refundTxItems };
  });

  // After commit: enqueue stock restore
  const productIds = result.items.map((i) => i.productId);
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

  const syncItems = result.items.map((item) => ({
    garagePartId: productMap.get(item.productId)?.garagePartId ?? null,
    quantity: item.quantity,
  }));
  await enqueueStockRestore(syncItems, refundId, `Refund of ${originalTxn.transactionNumber}`);

  return { ...result.transaction, items: result.items };
}

// ---------------------------------------------------------------------------
// Get transaction
// ---------------------------------------------------------------------------

/** Get a transaction with its items. */
export async function getTransaction(
  transactionId: string,
): Promise<TransactionWithItems | null> {
  const [txn] = await db
    .select()
    .from(posTransactions)
    .where(eq(posTransactions.id, transactionId))
    .limit(1);
  if (!txn) return null;

  const items = await db
    .select()
    .from(posTransactionItems)
    .where(eq(posTransactionItems.transactionId, transactionId));

  return { ...txn, items };
}

/** Get all transactions for a session. */
export async function getSessionTransactions(
  sessionId: string,
): Promise<PosTransaction[]> {
  return db
    .select()
    .from(posTransactions)
    .where(eq(posTransactions.sessionId, sessionId))
    .orderBy(desc(posTransactions.createdAt));
}

// ---------------------------------------------------------------------------
// Held carts
// ---------------------------------------------------------------------------

/** Hold a cart for later retrieval. */
export async function holdCart(
  name: string,
  items: object,
  heldBy: string,
): Promise<PosHeldCart> {
  const id = randomUUID();
  await db.insert(posHeldCarts).values({
    id,
    name,
    items,
    heldBy,
  });

  const [cart] = await db
    .select()
    .from(posHeldCarts)
    .where(eq(posHeldCarts.id, id))
    .limit(1);

  return cart;
}

/** Get all held carts. */
export async function getHeldCarts(): Promise<PosHeldCart[]> {
  return db
    .select()
    .from(posHeldCarts)
    .orderBy(desc(posHeldCarts.createdAt));
}

/** Get a single held cart by ID. */
export async function getHeldCart(id: string): Promise<PosHeldCart | null> {
  const [cart] = await db
    .select()
    .from(posHeldCarts)
    .where(eq(posHeldCarts.id, id))
    .limit(1);
  return cart ?? null;
}

/** Delete a held cart (e.g., when recalled or discarded). */
export async function deleteHeldCart(id: string): Promise<void> {
  await db.delete(posHeldCarts).where(eq(posHeldCarts.id, id));
}

// ---------------------------------------------------------------------------
// Quick product lookup
// ---------------------------------------------------------------------------

/**
 * Search products by barcode, part number, or name.
 * Only returns active products. Limit 20.
 */
export async function quickProductLookup(query: string): Promise<Product[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        sql`(
          ${products.barcode} = ${trimmed}
          OR ${products.partNumber} = ${trimmed}
          OR ${products.name} LIKE ${`%${trimmed}%`}
        )`,
      ),
    )
    .orderBy(asc(products.name))
    .limit(20);
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/**
 * Daily report: totals, counts, payment breakdown, top 10 products.
 * Defaults to today if no date is provided.
 */
export async function getDailyReport(date?: string): Promise<DailyReport> {
  const reportDate = date ?? new Date().toISOString().slice(0, 10);
  const dayStart = `${reportDate} 00:00:00`;
  const dayEnd = `${reportDate} 23:59:59`;

  // All completed sales for the day
  const salesRows = await db
    .select()
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.type, "sale"),
        eq(posTransactions.status, "completed"),
        sql`${posTransactions.createdAt} >= ${dayStart}`,
        sql`${posTransactions.createdAt} <= ${dayEnd}`,
      ),
    );

  const voidRows = await db
    .select()
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.status, "voided"),
        sql`${posTransactions.createdAt} >= ${dayStart}`,
        sql`${posTransactions.createdAt} <= ${dayEnd}`,
      ),
    );

  const refundRows = await db
    .select()
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.type, "refund"),
        eq(posTransactions.status, "completed"),
        sql`${posTransactions.createdAt} >= ${dayStart}`,
        sql`${posTransactions.createdAt} <= ${dayEnd}`,
      ),
    );

  // Totals
  const totalSales = salesRows.reduce((sum, r) => sum + parseFloat(r.total), 0);
  const refundTotal = refundRows.reduce((sum, r) => sum + parseFloat(r.total), 0);

  // Payment breakdown (sales only)
  const paymentBreakdown: Record<string, { count: number; total: number }> = {};
  for (const row of salesRows) {
    const method = row.paymentMethod;
    if (!paymentBreakdown[method]) {
      paymentBreakdown[method] = { count: 0, total: 0 };
    }
    paymentBreakdown[method].count += 1;
    paymentBreakdown[method].total += parseFloat(row.total);
  }

  // Top 10 products by quantity sold
  const saleIds = salesRows.map((r) => r.id);
  let topProducts: DailyReport["topProducts"] = [];

  if (saleIds.length > 0) {
    const topRows = await db
      .select({
        productId: posTransactionItems.productId,
        productName: posTransactionItems.productName,
        productNumber: posTransactionItems.productNumber,
        quantitySold: sql<number>`SUM(${posTransactionItems.quantity})`,
        revenue: sql<number>`SUM(${posTransactionItems.lineTotal})`,
      })
      .from(posTransactionItems)
      .where(
        sql`${posTransactionItems.transactionId} IN (${sql.join(
          saleIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .groupBy(
        posTransactionItems.productId,
        posTransactionItems.productName,
        posTransactionItems.productNumber,
      )
      .orderBy(sql`SUM(${posTransactionItems.quantity}) DESC`)
      .limit(10);

    topProducts = topRows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      productNumber: r.productNumber,
      quantitySold: Number(r.quantitySold),
      revenue: Number(r.revenue),
    }));
  }

  return {
    date: reportDate,
    totalSales,
    transactionCount: salesRows.length,
    voidCount: voidRows.length,
    refundCount: refundRows.length,
    refundTotal,
    paymentBreakdown,
    topProducts,
  };
}

/**
 * Session report: sales, counts, payment breakdown, cash variance.
 */
export async function getSessionReport(sessionId: string): Promise<SessionReport> {
  const [session] = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.id, sessionId))
    .limit(1);
  if (!session) throw new Error("Session not found");

  const txns = await db
    .select()
    .from(posTransactions)
    .where(eq(posTransactions.sessionId, sessionId));

  const sales = txns.filter((t) => t.type === "sale" && t.status === "completed");
  const voids = txns.filter((t) => t.status === "voided");
  const refunds = txns.filter((t) => t.type === "refund" && t.status === "completed");

  const salesTotal = sales.reduce((sum, t) => sum + parseFloat(t.total), 0);
  const refundTotal = refunds.reduce((sum, t) => sum + parseFloat(t.total), 0);

  const paymentBreakdown: Record<string, { count: number; total: number }> = {};
  for (const t of sales) {
    const method = t.paymentMethod;
    if (!paymentBreakdown[method]) {
      paymentBreakdown[method] = { count: 0, total: 0 };
    }
    paymentBreakdown[method].count += 1;
    paymentBreakdown[method].total += parseFloat(t.total);
  }

  return {
    session,
    salesTotal,
    transactionCount: sales.length,
    voidCount: voids.length,
    refundCount: refunds.length,
    refundTotal,
    paymentBreakdown,
    openingCash: parseFloat(session.openingCash),
    closingCash: session.closingCash ? parseFloat(session.closingCash) : null,
    expectedCash: session.expectedCash ? parseFloat(session.expectedCash) : null,
    cashDifference: session.cashDifference ? parseFloat(session.cashDifference) : null,
  };
}
