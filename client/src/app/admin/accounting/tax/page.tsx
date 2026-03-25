"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Globe, Monitor, ShoppingBag, Percent } from "lucide-react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface TaxSummary {
  totalTax: number;
  onlineTax: number;
  posTax: number;
  orderCount: number;
  taxRate: number;
}

function defaultStartDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function TaxSummaryPage() {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(todayString);

  const { data, isLoading } = useQuery<TaxSummary>({
    queryKey: ["tax-summary", startDate, endDate],
    queryFn: () =>
      api<TaxSummary>(
        `/api/store/admin/accounting/tax-summary?startDate=${startDate}&endDate=${endDate}`
      ),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tax Summary</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          GCT collected for tax filing
        </p>
      </div>

      {/* Date Filters */}
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
      </div>

      {/* Period Banner */}
      <div className="border rounded-md bg-primary/5 border-primary/20 p-4">
        <p className="text-sm font-medium">
          Tax Period: {startDate} to {endDate}
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : !data ? (
        <div className="text-center py-12 text-muted-foreground">No data available.</div>
      ) : (
        <>
          {/* Total GCT - Prominent */}
          <div className="border-2 border-primary/30 rounded-md bg-card p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
              <Receipt className="h-5 w-5" />
              <span className="text-sm font-medium">Total GCT Collected</span>
            </div>
            <p className="text-4xl font-bold">{formatPrice(data.totalTax)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {startDate} to {endDate}
            </p>
          </div>

          {/* Breakdown Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border rounded-md bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Globe className="h-4 w-4" />
                <span className="text-xs font-medium">Online Tax</span>
              </div>
              <p className="text-2xl font-bold">{formatPrice(data.onlineTax)}</p>
            </div>
            <div className="border rounded-md bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Monitor className="h-4 w-4" />
                <span className="text-xs font-medium">POS Tax</span>
              </div>
              <p className="text-2xl font-bold">{formatPrice(data.posTax)}</p>
            </div>
            <div className="border rounded-md bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <ShoppingBag className="h-4 w-4" />
                <span className="text-xs font-medium">Order Count</span>
              </div>
              <p className="text-2xl font-bold">{data.orderCount}</p>
            </div>
            <div className="border rounded-md bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Percent className="h-4 w-4" />
                <span className="text-xs font-medium">Tax Rate</span>
              </div>
              <p className="text-2xl font-bold">{data.taxRate}%</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
