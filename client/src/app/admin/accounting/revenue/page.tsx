"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Monitor,
  Globe,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface RevenuePeriod {
  period: string;
  posRevenue: number;
  onlineRevenue: number;
  total: number;
  orders: number;
  avgValue: number;
}

interface RevenueReport {
  periods: RevenuePeriod[];
  summary: {
    totalRevenue: number;
    posRevenue: number;
    onlineRevenue: number;
    avgOrderValue: number;
    totalOrders: number;
  };
}

function defaultStartDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function RevenueReportsPage() {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(todayString);
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  const { data, isLoading } = useQuery<RevenueReport>({
    queryKey: ["revenue-report", startDate, endDate, groupBy],
    queryFn: () =>
      api<RevenueReport>(
        `/api/store/admin/accounting/revenue?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`
      ),
  });

  const summary = data?.summary;
  const periods = data?.periods ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Revenue Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Revenue breakdown by period
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          />
        </div>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as "day" | "week" | "month")}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="day">Group by Day</option>
          <option value="week">Group by Week</option>
          <option value="month">Group by Month</option>
        </select>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold">{formatPrice(summary.totalRevenue)}</p>
          </div>
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Monitor className="h-4 w-4" />
              <span className="text-xs font-medium">POS Revenue</span>
            </div>
            <p className="text-2xl font-bold">{formatPrice(summary.posRevenue)}</p>
          </div>
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Globe className="h-4 w-4" />
              <span className="text-xs font-medium">Online Revenue</span>
            </div>
            <p className="text-2xl font-bold">{formatPrice(summary.onlineRevenue)}</p>
          </div>
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Avg Order Value</span>
            </div>
            <p className="text-2xl font-bold">{formatPrice(summary.avgOrderValue)}</p>
          </div>
        </div>
      )}

      {/* Revenue Table */}
      <div className="border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Period</th>
                <th className="text-right p-3 font-medium text-muted-foreground">POS Revenue</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Online Revenue</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Orders</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Avg Value</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    No data for this period
                  </td>
                </tr>
              ) : (
                <>
                  {periods.map((row) => (
                    <tr key={row.period} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{row.period}</td>
                      <td className="p-3 text-right">{formatPrice(row.posRevenue)}</td>
                      <td className="p-3 text-right">{formatPrice(row.onlineRevenue)}</td>
                      <td className="p-3 text-right font-semibold">{formatPrice(row.total)}</td>
                      <td className="p-3 text-right">{row.orders}</td>
                      <td className="p-3 text-right">{formatPrice(row.avgValue)}</td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  {summary && (
                    <tr className="border-t-2 bg-muted/20 font-semibold">
                      <td className="p-3">Total</td>
                      <td className="p-3 text-right">{formatPrice(summary.posRevenue)}</td>
                      <td className="p-3 text-right">{formatPrice(summary.onlineRevenue)}</td>
                      <td className="p-3 text-right">{formatPrice(summary.totalRevenue)}</td>
                      <td className="p-3 text-right">{summary.totalOrders}</td>
                      <td className="p-3 text-right">{formatPrice(summary.avgOrderValue)}</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
