/**
 * Accounting & reporting storage module.
 *
 * Provides end-of-day reports, revenue reports, tax summaries,
 * customer account statements, and cash management reports.
 *
 * Queries POS sessions/transactions, online orders, and returns
 * to produce consolidated financial views for admin/manager use.
 */

import { eq, and, sql, desc, gte, lt } from "drizzle-orm";
import { db } from "../db.js";
import {
  posSessions,
  posTransactions,
  onlineStoreOrders,
  onlineStoreReturns,
  customers,
  storeSettings,
} from "../schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EndOfDayReport {
  date: string;
  posSessions: Array<{
    id: string;
    openedBy: string;
    closedAt: Date | null;
    openingCash: string;
    closingCash: string | null;
    cashVariance: string | null;
    totalSales: string;
    totalRefunds: string;
    transactionCount: number;
  }>;
  onlineOrders: {
    placed: number;
    confirmed: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    totalRevenue: string;
  };
  returns: {
    requested: number;
    approved: number;
    refunded: number;
    totalRefunded: string;
  };
  cashSummary: {
    openingTotal: string;
    cashSales: string;
    cashRefunds: string;
    expectedCash: string;
    actualCash: string;
    variance: string;
  };
  paymentBreakdown: {
    cash: string;
    card: string;
    online: string;
    total: string;
  };
  taxCollected: string;
}

export interface RevenuePeriod {
  period: string;
  posRevenue: string;
  onlineRevenue: string;
  totalRevenue: string;
  orderCount: number;
  avgOrderValue: string;
}

export interface RevenueReport {
  periods: RevenuePeriod[];
  totals: {
    posRevenue: string;
    onlineRevenue: string;
    totalRevenue: string;
    orderCount: number;
  };
}

export interface TaxSummary {
  totalTaxCollected: string;
  onlineTax: string;
  posTax: string;
  orderCount: number;
  taxRate: string;
}

export interface CustomerStatement {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    storeCreditBalance: string;
  };
  orders: Array<{
    orderNumber: string;
    date: Date;
    total: string;
    status: string;
    paymentStatus: string | null;
  }>;
  returns: Array<{
    returnNumber: string;
    date: Date;
    refundAmount: string | null;
    status: string;
  }>;
  summary: {
    totalSpent: string;
    totalRefunded: string;
    orderCount: number;
    storeCreditBalance: string;
  };
}

export interface CashReport {
  sessions: Array<{
    id: string;
    cashier: string;
    openingCash: string;
    closingCash: string | null;
    cashSales: string;
    cashRefunds: string;
    variance: string | null;
    openedAt: Date;
    closedAt: Date | null;
  }>;
  totalOpening: string;
  totalClosing: string;
  totalVariance: string;
  netCashFlow: string;
}

// ---------------------------------------------------------------------------
// End of Day Report
// ---------------------------------------------------------------------------

export async function getEndOfDayReport(date: string): Promise<EndOfDayReport> {
  const dayStart = `${date} 00:00:00`;
  const dayEnd = `${date} 23:59:59`;

  // --- POS Sessions for the day ---
  const sessions = await db
    .select()
    .from(posSessions)
    .where(
      and(
        sql`${posSessions.openedAt} >= ${dayStart}`,
        sql`${posSessions.openedAt} <= ${dayEnd}`,
      ),
    );

  // Build per-session summaries
  const sessionSummaries = await Promise.all(
    sessions.map(async (session) => {
      const [salesResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${posTransactions.total}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(posTransactions)
        .where(
          and(
            eq(posTransactions.sessionId, session.id),
            eq(posTransactions.type, "sale"),
            eq(posTransactions.status, "completed"),
          ),
        );

      const [refundsResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${posTransactions.total}), 0)`,
        })
        .from(posTransactions)
        .where(
          and(
            eq(posTransactions.sessionId, session.id),
            eq(posTransactions.type, "refund"),
            eq(posTransactions.status, "completed"),
          ),
        );

      return {
        id: session.id,
        openedBy: session.openedBy,
        closedAt: session.closedAt,
        openingCash: session.openingCash,
        closingCash: session.closingCash,
        cashVariance: session.cashDifference,
        totalSales: salesResult.total,
        totalRefunds: refundsResult.total,
        transactionCount: Number(salesResult.count),
      };
    }),
  );

  // --- Online orders for the day ---
  const onlinePlaced = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(onlineStoreOrders)
    .where(
      and(
        sql`${onlineStoreOrders.placedAt} >= ${dayStart}`,
        sql`${onlineStoreOrders.placedAt} <= ${dayEnd}`,
      ),
    );

  const onlineConfirmed = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(onlineStoreOrders)
    .where(
      and(
        sql`${onlineStoreOrders.confirmedAt} >= ${dayStart}`,
        sql`${onlineStoreOrders.confirmedAt} <= ${dayEnd}`,
      ),
    );

  const onlineShipped = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(onlineStoreOrders)
    .where(
      and(
        sql`${onlineStoreOrders.shippedAt} >= ${dayStart}`,
        sql`${onlineStoreOrders.shippedAt} <= ${dayEnd}`,
      ),
    );

  const onlineDelivered = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(onlineStoreOrders)
    .where(
      and(
        sql`${onlineStoreOrders.deliveredAt} >= ${dayStart}`,
        sql`${onlineStoreOrders.deliveredAt} <= ${dayEnd}`,
      ),
    );

  const onlineCancelled = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(onlineStoreOrders)
    .where(
      and(
        sql`${onlineStoreOrders.cancelledAt} >= ${dayStart}`,
        sql`${onlineStoreOrders.cancelledAt} <= ${dayEnd}`,
      ),
    );

  // Total online revenue: orders placed on this date that are not cancelled
  const [onlineRevenueResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${onlineStoreOrders.total}), 0)`,
    })
    .from(onlineStoreOrders)
    .where(
      and(
        sql`${onlineStoreOrders.placedAt} >= ${dayStart}`,
        sql`${onlineStoreOrders.placedAt} <= ${dayEnd}`,
        sql`${onlineStoreOrders.status} != 'cancelled'`,
      ),
    );

  // --- Returns for the day ---
  const returnsRequested = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(onlineStoreReturns)
    .where(
      and(
        sql`${onlineStoreReturns.requestedAt} >= ${dayStart}`,
        sql`${onlineStoreReturns.requestedAt} <= ${dayEnd}`,
      ),
    );

  const returnsApproved = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(onlineStoreReturns)
    .where(
      and(
        sql`${onlineStoreReturns.approvedAt} >= ${dayStart}`,
        sql`${onlineStoreReturns.approvedAt} <= ${dayEnd}`,
      ),
    );

  const returnsRefunded = await db
    .select({
      count: sql<number>`COUNT(*)`,
      total: sql<string>`COALESCE(SUM(${onlineStoreReturns.refundAmount}), 0)`,
    })
    .from(onlineStoreReturns)
    .where(
      and(
        eq(onlineStoreReturns.status, "refunded"),
        sql`${onlineStoreReturns.closedAt} >= ${dayStart}`,
        sql`${onlineStoreReturns.closedAt} <= ${dayEnd}`,
      ),
    );

  // --- Cash summary across all POS sessions ---
  // Cash sales for the day (all sessions)
  const [cashSalesResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${posTransactions.total}), 0)`,
    })
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.type, "sale"),
        eq(posTransactions.status, "completed"),
        eq(posTransactions.paymentMethod, "cash"),
        sql`${posTransactions.createdAt} >= ${dayStart}`,
        sql`${posTransactions.createdAt} <= ${dayEnd}`,
      ),
    );

  const [cashRefundsResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${posTransactions.total}), 0)`,
    })
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.type, "refund"),
        eq(posTransactions.status, "completed"),
        eq(posTransactions.paymentMethod, "cash"),
        sql`${posTransactions.createdAt} >= ${dayStart}`,
        sql`${posTransactions.createdAt} <= ${dayEnd}`,
      ),
    );

  const openingTotal = sessions.reduce(
    (sum, s) => sum + parseFloat(s.openingCash),
    0,
  );
  const cashSales = parseFloat(cashSalesResult.total);
  const cashRefunds = parseFloat(cashRefundsResult.total);
  const expectedCash = openingTotal + cashSales - cashRefunds;
  const actualCash = sessions.reduce(
    (sum, s) => sum + (s.closingCash ? parseFloat(s.closingCash) : 0),
    0,
  );
  const variance = actualCash - expectedCash;

  // --- Payment breakdown (POS) ---
  const [cardSalesResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${posTransactions.total}), 0)`,
    })
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.type, "sale"),
        eq(posTransactions.status, "completed"),
        sql`${posTransactions.paymentMethod} IN ('card', 'saved_card')`,
        sql`${posTransactions.createdAt} >= ${dayStart}`,
        sql`${posTransactions.createdAt} <= ${dayEnd}`,
      ),
    );

  // Split payments: sum cash + card portions
  const splitTransactions = await db
    .select()
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.type, "sale"),
        eq(posTransactions.status, "completed"),
        eq(posTransactions.paymentMethod, "split"),
        sql`${posTransactions.createdAt} >= ${dayStart}`,
        sql`${posTransactions.createdAt} <= ${dayEnd}`,
      ),
    );

  let splitCash = 0;
  let splitCard = 0;
  for (const txn of splitTransactions) {
    if (txn.cardTransactionId) {
      try {
        const meta = JSON.parse(txn.cardTransactionId);
        splitCash += parseFloat(meta.cashAmount || "0");
        splitCard += parseFloat(meta.cardAmount || "0");
      } catch {
        // fallback: count full amount as split
        splitCash += parseFloat(txn.total) / 2;
        splitCard += parseFloat(txn.total) / 2;
      }
    }
  }

  const totalCash = cashSales + splitCash;
  const totalCard = parseFloat(cardSalesResult.total) + splitCard;
  const totalOnline = parseFloat(onlineRevenueResult.total);
  const totalAll = totalCash + totalCard + totalOnline;

  // --- Tax collected ---
  const [posTaxResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${posTransactions.taxAmount}), 0)`,
    })
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.type, "sale"),
        eq(posTransactions.status, "completed"),
        sql`${posTransactions.createdAt} >= ${dayStart}`,
        sql`${posTransactions.createdAt} <= ${dayEnd}`,
      ),
    );

  const [onlineTaxResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${onlineStoreOrders.taxAmount}), 0)`,
    })
    .from(onlineStoreOrders)
    .where(
      and(
        sql`${onlineStoreOrders.placedAt} >= ${dayStart}`,
        sql`${onlineStoreOrders.placedAt} <= ${dayEnd}`,
        sql`${onlineStoreOrders.status} != 'cancelled'`,
      ),
    );

  const taxCollected =
    parseFloat(posTaxResult.total) + parseFloat(onlineTaxResult.total);

  return {
    date,
    posSessions: sessionSummaries,
    onlineOrders: {
      placed: Number(onlinePlaced[0].count),
      confirmed: Number(onlineConfirmed[0].count),
      shipped: Number(onlineShipped[0].count),
      delivered: Number(onlineDelivered[0].count),
      cancelled: Number(onlineCancelled[0].count),
      totalRevenue: parseFloat(onlineRevenueResult.total).toFixed(2),
    },
    returns: {
      requested: Number(returnsRequested[0].count),
      approved: Number(returnsApproved[0].count),
      refunded: Number(returnsRefunded[0].count),
      totalRefunded: parseFloat(returnsRefunded[0].total).toFixed(2),
    },
    cashSummary: {
      openingTotal: openingTotal.toFixed(2),
      cashSales: cashSales.toFixed(2),
      cashRefunds: cashRefunds.toFixed(2),
      expectedCash: expectedCash.toFixed(2),
      actualCash: actualCash.toFixed(2),
      variance: variance.toFixed(2),
    },
    paymentBreakdown: {
      cash: totalCash.toFixed(2),
      card: totalCard.toFixed(2),
      online: totalOnline.toFixed(2),
      total: totalAll.toFixed(2),
    },
    taxCollected: taxCollected.toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// Revenue Report
// ---------------------------------------------------------------------------

export async function getRevenueReport(params: {
  startDate: string;
  endDate: string;
  groupBy: "day" | "week" | "month";
}): Promise<RevenueReport> {
  const { startDate, endDate, groupBy } = params;
  const start = `${startDate} 00:00:00`;
  const end = `${endDate} 23:59:59`;

  // MySQL DATE_FORMAT patterns for grouping
  const dateFormat =
    groupBy === "day"
      ? "%Y-%m-%d"
      : groupBy === "week"
        ? "%x-W%v"
        : "%Y-%m";

  // POS revenue grouped by period
  const posRows = await db
    .select({
      period: sql<string>`DATE_FORMAT(${posTransactions.createdAt}, ${dateFormat})`,
      revenue: sql<string>`COALESCE(SUM(${posTransactions.total}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.type, "sale"),
        eq(posTransactions.status, "completed"),
        sql`${posTransactions.createdAt} >= ${start}`,
        sql`${posTransactions.createdAt} <= ${end}`,
      ),
    )
    .groupBy(sql`DATE_FORMAT(${posTransactions.createdAt}, ${dateFormat})`)
    .orderBy(sql`DATE_FORMAT(${posTransactions.createdAt}, ${dateFormat})`);

  // Online revenue grouped by period
  const onlineRows = await db
    .select({
      period: sql<string>`DATE_FORMAT(${onlineStoreOrders.placedAt}, ${dateFormat})`,
      revenue: sql<string>`COALESCE(SUM(${onlineStoreOrders.total}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(onlineStoreOrders)
    .where(
      and(
        sql`${onlineStoreOrders.placedAt} >= ${start}`,
        sql`${onlineStoreOrders.placedAt} <= ${end}`,
        sql`${onlineStoreOrders.status} != 'cancelled'`,
      ),
    )
    .groupBy(sql`DATE_FORMAT(${onlineStoreOrders.placedAt}, ${dateFormat})`)
    .orderBy(sql`DATE_FORMAT(${onlineStoreOrders.placedAt}, ${dateFormat})`);

  // Merge periods
  const posMap = new Map(
    posRows.map((r) => [
      r.period,
      { revenue: parseFloat(r.revenue), count: Number(r.count) },
    ]),
  );
  const onlineMap = new Map(
    onlineRows.map((r) => [
      r.period,
      { revenue: parseFloat(r.revenue), count: Number(r.count) },
    ]),
  );

  const allPeriods = new Set([...posMap.keys(), ...onlineMap.keys()]);
  const sortedPeriods = Array.from(allPeriods).sort();

  let totalPosRevenue = 0;
  let totalOnlineRevenue = 0;
  let totalOrderCount = 0;

  const periods: RevenuePeriod[] = sortedPeriods.map((period) => {
    const pos = posMap.get(period) ?? { revenue: 0, count: 0 };
    const online = onlineMap.get(period) ?? { revenue: 0, count: 0 };
    const totalRevenue = pos.revenue + online.revenue;
    const orderCount = pos.count + online.count;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    totalPosRevenue += pos.revenue;
    totalOnlineRevenue += online.revenue;
    totalOrderCount += orderCount;

    return {
      period,
      posRevenue: pos.revenue.toFixed(2),
      onlineRevenue: online.revenue.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      orderCount,
      avgOrderValue: avgOrderValue.toFixed(2),
    };
  });

  return {
    periods,
    totals: {
      posRevenue: totalPosRevenue.toFixed(2),
      onlineRevenue: totalOnlineRevenue.toFixed(2),
      totalRevenue: (totalPosRevenue + totalOnlineRevenue).toFixed(2),
      orderCount: totalOrderCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Tax Summary
// ---------------------------------------------------------------------------

export async function getTaxSummary(params: {
  startDate: string;
  endDate: string;
}): Promise<TaxSummary> {
  const { startDate, endDate } = params;
  const start = `${startDate} 00:00:00`;
  const end = `${endDate} 23:59:59`;

  // POS tax
  const [posTaxResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${posTransactions.taxAmount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.type, "sale"),
        eq(posTransactions.status, "completed"),
        sql`${posTransactions.createdAt} >= ${start}`,
        sql`${posTransactions.createdAt} <= ${end}`,
      ),
    );

  // Online tax
  const [onlineTaxResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${onlineStoreOrders.taxAmount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(onlineStoreOrders)
    .where(
      and(
        sql`${onlineStoreOrders.placedAt} >= ${start}`,
        sql`${onlineStoreOrders.placedAt} <= ${end}`,
        sql`${onlineStoreOrders.status} != 'cancelled'`,
      ),
    );

  const posTax = parseFloat(posTaxResult.total);
  const onlineTax = parseFloat(onlineTaxResult.total);
  const totalCount = Number(posTaxResult.count) + Number(onlineTaxResult.count);

  // Get current tax rate from settings
  const [settings] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.id, 1))
    .limit(1);
  const taxRate = settings ? settings.taxRate : "15.00";

  return {
    totalTaxCollected: (posTax + onlineTax).toFixed(2),
    onlineTax: onlineTax.toFixed(2),
    posTax: posTax.toFixed(2),
    orderCount: totalCount,
    taxRate,
  };
}

// ---------------------------------------------------------------------------
// Customer Account Statement
// ---------------------------------------------------------------------------

export async function getCustomerStatement(
  customerId: string,
  params: { startDate?: string; endDate?: string },
): Promise<CustomerStatement> {
  // Load customer
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) throw new Error("Customer not found");

  // Build date conditions for orders
  const orderConditions = [eq(onlineStoreOrders.customerId, customerId)];
  if (params.startDate) {
    orderConditions.push(
      sql`${onlineStoreOrders.createdAt} >= ${params.startDate + " 00:00:00"}`,
    );
  }
  if (params.endDate) {
    orderConditions.push(
      sql`${onlineStoreOrders.createdAt} <= ${params.endDate + " 23:59:59"}`,
    );
  }

  const orderRows = await db
    .select()
    .from(onlineStoreOrders)
    .where(and(...orderConditions))
    .orderBy(desc(onlineStoreOrders.createdAt));

  // Build date conditions for returns
  const returnConditions = [eq(onlineStoreReturns.customerId, customerId)];
  if (params.startDate) {
    returnConditions.push(
      sql`${onlineStoreReturns.createdAt} >= ${params.startDate + " 00:00:00"}`,
    );
  }
  if (params.endDate) {
    returnConditions.push(
      sql`${onlineStoreReturns.createdAt} <= ${params.endDate + " 23:59:59"}`,
    );
  }

  const returnRows = await db
    .select()
    .from(onlineStoreReturns)
    .where(and(...returnConditions))
    .orderBy(desc(onlineStoreReturns.createdAt));

  // Calculate summary
  const totalSpent = orderRows
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + parseFloat(o.total), 0);

  const totalRefunded = returnRows
    .filter((r) => r.status === "refunded" && r.refundAmount)
    .reduce((sum, r) => sum + parseFloat(r.refundAmount!), 0);

  const customerName = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(" ") || customer.email;

  return {
    customer: {
      id: customer.id,
      name: customerName,
      email: customer.email,
      phone: customer.phone,
      storeCreditBalance: customer.storeCreditBalance,
    },
    orders: orderRows.map((o) => ({
      orderNumber: o.orderNumber,
      date: o.createdAt,
      total: o.total,
      status: o.status,
      paymentStatus: o.paymentStatus,
    })),
    returns: returnRows.map((r) => ({
      returnNumber: r.returnNumber,
      date: r.createdAt,
      refundAmount: r.refundAmount,
      status: r.status,
    })),
    summary: {
      totalSpent: totalSpent.toFixed(2),
      totalRefunded: totalRefunded.toFixed(2),
      orderCount: orderRows.length,
      storeCreditBalance: customer.storeCreditBalance,
    },
  };
}

// ---------------------------------------------------------------------------
// Cash Report
// ---------------------------------------------------------------------------

export async function getCashReport(date: string): Promise<CashReport> {
  const dayStart = `${date} 00:00:00`;
  const dayEnd = `${date} 23:59:59`;

  // Get all sessions that were opened on this date
  const sessions = await db
    .select()
    .from(posSessions)
    .where(
      and(
        sql`${posSessions.openedAt} >= ${dayStart}`,
        sql`${posSessions.openedAt} <= ${dayEnd}`,
      ),
    )
    .orderBy(posSessions.openedAt);

  // For each session, calculate cash sales and refunds
  const sessionDetails = await Promise.all(
    sessions.map(async (session) => {
      const [cashSalesResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${posTransactions.total}), 0)`,
        })
        .from(posTransactions)
        .where(
          and(
            eq(posTransactions.sessionId, session.id),
            eq(posTransactions.type, "sale"),
            eq(posTransactions.status, "completed"),
            eq(posTransactions.paymentMethod, "cash"),
          ),
        );

      // Also include cash portion of split payments
      const splitTxns = await db
        .select()
        .from(posTransactions)
        .where(
          and(
            eq(posTransactions.sessionId, session.id),
            eq(posTransactions.type, "sale"),
            eq(posTransactions.status, "completed"),
            eq(posTransactions.paymentMethod, "split"),
          ),
        );

      let splitCashSales = 0;
      for (const txn of splitTxns) {
        if (txn.cardTransactionId) {
          try {
            const meta = JSON.parse(txn.cardTransactionId);
            splitCashSales += parseFloat(meta.cashAmount || "0");
          } catch {
            // ignore parse errors
          }
        }
      }

      const [cashRefundsResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${posTransactions.total}), 0)`,
        })
        .from(posTransactions)
        .where(
          and(
            eq(posTransactions.sessionId, session.id),
            eq(posTransactions.type, "refund"),
            eq(posTransactions.status, "completed"),
            eq(posTransactions.paymentMethod, "cash"),
          ),
        );

      const cashSales = parseFloat(cashSalesResult.total) + splitCashSales;
      const cashRefunds = parseFloat(cashRefundsResult.total);

      return {
        id: session.id,
        cashier: session.openedBy,
        openingCash: session.openingCash,
        closingCash: session.closingCash,
        cashSales: cashSales.toFixed(2),
        cashRefunds: cashRefunds.toFixed(2),
        variance: session.cashDifference,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
      };
    }),
  );

  const totalOpening = sessionDetails.reduce(
    (sum, s) => sum + parseFloat(s.openingCash),
    0,
  );
  const totalClosing = sessionDetails.reduce(
    (sum, s) => sum + (s.closingCash ? parseFloat(s.closingCash) : 0),
    0,
  );
  const totalVariance = sessionDetails.reduce(
    (sum, s) => sum + (s.variance ? parseFloat(s.variance) : 0),
    0,
  );
  const netCashFlow = sessionDetails.reduce(
    (sum, s) => sum + parseFloat(s.cashSales) - parseFloat(s.cashRefunds),
    0,
  );

  return {
    sessions: sessionDetails,
    totalOpening: totalOpening.toFixed(2),
    totalClosing: totalClosing.toFixed(2),
    totalVariance: totalVariance.toFixed(2),
    netCashFlow: netCashFlow.toFixed(2),
  };
}
