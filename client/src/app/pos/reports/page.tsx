"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign, RotateCcw, TrendingUp, Hash,
  Banknote, CreditCard, Split, ChevronLeft, ChevronRight,
  Loader2, BarChart3, Clock, AlertTriangle,
} from "lucide-react";
import { format, subDays, addDays } from "date-fns";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface DailyReport {
  totalSales: number;
  totalRefunds: number;
  netSales: number;
  transactionCount: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    split: number;
  };
  topProducts: {
    productName: string;
    partNumber: string;
    qtySold: number;
    revenue: number;
  }[];
  sessions: {
    id: string;
    sessionNumber: string;
    openedAt: string;
    closedAt: string | null;
    openingCash: string;
    closingCash: string | null;
    variance: number | null;
  }[];
}

interface SessionReport {
  id: string;
  sessionNumber: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: string;
  closingCash: string | null;
  expectedCash: number;
  variance: number | null;
  totalSales: number;
  transactionCount: number;
  transactions: {
    id: string;
    transactionNumber: string;
    total: string;
    paymentMethod: string;
    createdAt: string;
  }[];
}

export default function PosReportsPage() {
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const { data: report, isLoading } = useQuery<DailyReport>({
    queryKey: ["pos-daily-report", selectedDate],
    queryFn: () => api<DailyReport>(`/api/store/pos/reports/daily?date=${selectedDate}`),
  });

  const { data: sessionReport, isLoading: sessionLoading } = useQuery<SessionReport>({
    queryKey: ["pos-session-report", selectedSession],
    queryFn: () => api<SessionReport>(`/api/store/pos/reports/session/${selectedSession}`),
    enabled: !!selectedSession,
  });

  const goDay = (delta: number) => {
    const current = new Date(selectedDate);
    const next = delta > 0 ? addDays(current, 1) : subDays(current, 1);
    setSelectedDate(format(next, "yyyy-MM-dd"));
    setSelectedSession(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">POS Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Daily sales summary and session history</p>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => goDay(-1)}
          className="p-2 border rounded-lg hover:bg-accent transition-colors"
          title="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); setSelectedSession(null); }}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={() => goDay(1)}
          className="p-2 border rounded-lg hover:bg-accent transition-colors"
          title="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-sm text-muted-foreground ml-2">
          {format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !report ? (
        <div className="text-center py-20 text-muted-foreground">
          <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
          <p>No data for this date</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border rounded-xl bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium">Total Sales</span>
              </div>
              <p className="text-2xl font-bold">{formatPrice(report.totalSales)}</p>
            </div>
            <div className="border rounded-xl bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <RotateCcw className="h-4 w-4" />
                <span className="text-xs font-medium">Total Refunds</span>
              </div>
              <p className="text-2xl font-bold text-destructive">{formatPrice(report.totalRefunds)}</p>
            </div>
            <div className="border rounded-xl bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Net Sales</span>
              </div>
              <p className="text-2xl font-bold">{formatPrice(report.netSales)}</p>
            </div>
            <div className="border rounded-xl bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Hash className="h-4 w-4" />
                <span className="text-xs font-medium">Transactions</span>
              </div>
              <p className="text-2xl font-bold">{report.transactionCount}</p>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="px-5 py-3 bg-muted/40 border-b">
              <h2 className="font-semibold text-sm">Payment Breakdown</h2>
            </div>
            <div className="grid grid-cols-3 divide-x">
              <div className="p-5 text-center">
                <Banknote className="h-5 w-5 text-green-600 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Cash</p>
                <p className="text-lg font-bold">{formatPrice(report.paymentBreakdown.cash)}</p>
              </div>
              <div className="p-5 text-center">
                <CreditCard className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Card</p>
                <p className="text-lg font-bold">{formatPrice(report.paymentBreakdown.card)}</p>
              </div>
              <div className="p-5 text-center">
                <Split className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Split</p>
                <p className="text-lg font-bold">{formatPrice(report.paymentBreakdown.split)}</p>
              </div>
            </div>
          </div>

          {/* Top Products */}
          {report.topProducts.length > 0 && (
            <div className="border rounded-xl bg-card overflow-hidden">
              <div className="px-5 py-3 bg-muted/40 border-b">
                <h2 className="font-semibold text-sm">Top 10 Products</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Part #</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Qty Sold</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topProducts.map((product, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-medium">{product.productName}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{product.partNumber}</td>
                        <td className="p-3 text-right">{product.qtySold}</td>
                        <td className="p-3 text-right font-medium">{formatPrice(product.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Session History */}
          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="px-5 py-3 bg-muted/40 border-b">
              <h2 className="font-semibold text-sm">Session History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left p-3 font-medium text-muted-foreground">Session #</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Opened</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Closed</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Opening Cash</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Closing Cash</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">No sessions for this date</td>
                    </tr>
                  ) : report.sessions.map((sess) => (
                    <tr
                      key={sess.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedSession(sess.id)}
                    >
                      <td className="p-3 font-mono text-xs font-semibold">{sess.sessionNumber}</td>
                      <td className="p-3 text-muted-foreground">{format(new Date(sess.openedAt), "h:mm a")}</td>
                      <td className="p-3 text-muted-foreground">{sess.closedAt ? format(new Date(sess.closedAt), "h:mm a") : "Open"}</td>
                      <td className="p-3 text-right">{formatPrice(sess.openingCash)}</td>
                      <td className="p-3 text-right">{sess.closingCash !== null ? formatPrice(sess.closingCash) : "\u2014"}</td>
                      <td className="p-3 text-right">
                        {sess.variance !== null ? (
                          <span className={`inline-flex items-center gap-1 ${sess.variance < 0 ? "text-destructive" : sess.variance > 0 ? "text-green-600" : ""}`}>
                            {sess.variance < 0 && <AlertTriangle className="h-3.5 w-3.5" />}
                            {formatPrice(sess.variance)}
                          </span>
                        ) : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Session Detail */}
          {selectedSession && (
            <div className="border rounded-xl bg-card overflow-hidden">
              <div className="px-5 py-3 bg-muted/40 border-b flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Session Detail
                </h2>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>
              {sessionLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : sessionReport ? (
                <div>
                  {/* Session summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 border-b">
                    <div>
                      <span className="text-xs text-muted-foreground block mb-0.5">Session</span>
                      <span className="text-sm font-semibold font-mono">{sessionReport.sessionNumber}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-0.5">Total Sales</span>
                      <span className="text-sm font-semibold">{formatPrice(sessionReport.totalSales)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-0.5">Transactions</span>
                      <span className="text-sm font-semibold">{sessionReport.transactionCount}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-0.5">Variance</span>
                      <span className={`text-sm font-semibold ${sessionReport.variance !== null && sessionReport.variance < 0 ? "text-destructive" : ""}`}>
                        {sessionReport.variance !== null ? formatPrice(sessionReport.variance) : "\u2014"}
                      </span>
                    </div>
                  </div>

                  {/* Transaction list */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/20">
                          <th className="text-left p-3 font-medium text-muted-foreground">Transaction #</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionReport.transactions.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-muted-foreground">No transactions in this session</td>
                          </tr>
                        ) : sessionReport.transactions.map((txn) => (
                          <tr key={txn.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-mono text-xs font-semibold">{txn.transactionNumber}</td>
                            <td className="p-3">
                              <span className="capitalize text-muted-foreground">{txn.paymentMethod}</span>
                            </td>
                            <td className="p-3 text-right font-medium">{formatPrice(txn.total)}</td>
                            <td className="p-3 text-muted-foreground">{format(new Date(txn.createdAt), "h:mm a")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">Session not found</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
