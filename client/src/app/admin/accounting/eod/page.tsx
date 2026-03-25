"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  DollarSign,
  CreditCard,
  Globe,
  Banknote,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface PosSession {
  id: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number;
  variance: number;
  transactionCount: number;
}

interface EodReport {
  date: string;
  totalRevenue: number;
  cashCollected: number;
  taxCollected: number;
  orderCount: number;
  posSessions: PosSession[];
  cashReconciliation: {
    openingTotal: number;
    cashSales: number;
    cashRefunds: number;
    expectedCash: number;
    actualCash: number;
    variance: number;
  };
  paymentBreakdown: { cash: number; card: number; online: number };
  onlineOrders: {
    placed: number;
    confirmed: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    revenue: number;
  };
  returns: {
    requested: number;
    approved: number;
    refunded: number;
    totalAmount: number;
  };
}

function todayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function EodReportPage() {
  const [date, setDate] = useState(todayString);

  const { data, isLoading } = useQuery<EodReport>({
    queryKey: ["eod-report", date],
    queryFn: () =>
      api<EodReport>(`/api/store/admin/accounting/eod-report?date=${date}`),
  });

  return (
    <div className="space-y-6 print:shadow-none print:border-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">End of Day Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daily cash and sales reconciliation
          </p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          />
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-4">
        <h2 className="text-lg font-bold">316 Parts Store - End of Day Report</h2>
        <p className="text-sm">{date}</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading report...
        </div>
      ) : !data ? (
        <div className="text-center py-12 text-muted-foreground">
          No data available for this date.
        </div>
      ) : (
        <>
          {/* POS Sessions */}
          <section>
            <h2 className="text-lg font-semibold mb-3">POS Sessions</h2>
            <div className="border rounded-md bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left p-3 font-medium text-muted-foreground">Cashier</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Opening Cash</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Closing Cash</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Expected</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Variance</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.posSessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          No POS sessions for this date
                        </td>
                      </tr>
                    ) : (
                      data.posSessions.map((session) => (
                        <tr key={session.id} className="border-b last:border-0">
                          <td className="p-3 font-medium">{session.cashierName}</td>
                          <td className="p-3 text-right">{formatPrice(session.openingCash)}</td>
                          <td className="p-3 text-right">
                            {session.closingCash != null ? formatPrice(session.closingCash) : "Open"}
                          </td>
                          <td className="p-3 text-right">{formatPrice(session.expectedCash)}</td>
                          <td className={`p-3 text-right font-medium ${session.variance !== 0 ? "text-red-600" : "text-green-600"}`}>
                            {formatPrice(session.variance)}
                            {session.variance !== 0 && (
                              <AlertTriangle className="h-3.5 w-3.5 inline ml-1" />
                            )}
                          </td>
                          <td className="p-3 text-right">{session.transactionCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Cash Reconciliation */}
          {data.cashReconciliation && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Cash Reconciliation</h2>
              <div className="border rounded-md bg-card p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Opening Total</p>
                    <p className="text-lg font-semibold">{formatPrice(data.cashReconciliation.openingTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cash Sales</p>
                    <p className="text-lg font-semibold text-green-600">+{formatPrice(data.cashReconciliation.cashSales)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cash Refunds</p>
                    <p className="text-lg font-semibold text-red-600">-{formatPrice(data.cashReconciliation.cashRefunds)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Expected Cash</p>
                    <p className="text-lg font-semibold">{formatPrice(data.cashReconciliation.expectedCash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual Cash</p>
                    <p className="text-lg font-semibold">{formatPrice(data.cashReconciliation.actualCash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={`text-lg font-semibold ${data.cashReconciliation.variance !== 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatPrice(data.cashReconciliation.variance)}
                      {data.cashReconciliation.variance !== 0 && (
                        <AlertTriangle className="h-4 w-4 inline ml-1.5" />
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Payment Breakdown */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Payment Breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border rounded-md bg-card p-5">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Banknote className="h-4 w-4" />
                  <span className="text-xs font-medium">Cash</span>
                </div>
                <p className="text-2xl font-bold">{formatPrice(data.paymentBreakdown.cash)}</p>
              </div>
              <div className="border rounded-md bg-card p-5">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-xs font-medium">Card</span>
                </div>
                <p className="text-2xl font-bold">{formatPrice(data.paymentBreakdown.card)}</p>
              </div>
              <div className="border rounded-md bg-card p-5">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Globe className="h-4 w-4" />
                  <span className="text-xs font-medium">Online</span>
                </div>
                <p className="text-2xl font-bold">{formatPrice(data.paymentBreakdown.online)}</p>
              </div>
            </div>
          </section>

          {/* Online Orders Summary */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Online Orders</h2>
            <div className="border rounded-md bg-card p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Placed</p>
                  <p className="text-xl font-bold">{data.onlineOrders.placed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Confirmed</p>
                  <p className="text-xl font-bold">{data.onlineOrders.confirmed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Shipped</p>
                  <p className="text-xl font-bold">{data.onlineOrders.shipped}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Delivered</p>
                  <p className="text-xl font-bold">{data.onlineOrders.delivered}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cancelled</p>
                  <p className="text-xl font-bold">{data.onlineOrders.cancelled}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                  <p className="text-xl font-bold">{formatPrice(data.onlineOrders.revenue)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Returns Summary */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Returns</h2>
            <div className="border rounded-md bg-card p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Requested</p>
                  <p className="text-xl font-bold">{data.returns.requested}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Approved</p>
                  <p className="text-xl font-bold">{data.returns.approved}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Refunded</p>
                  <p className="text-xl font-bold">{data.returns.refunded}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                  <p className="text-xl font-bold">{formatPrice(data.returns.totalAmount)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Tax Collected */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Tax Collected</h2>
            <div className="border rounded-md bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium">Total GCT for {date}</span>
              </div>
              <p className="text-3xl font-bold">{formatPrice(data.taxCollected)}</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
