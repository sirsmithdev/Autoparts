"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  DollarSign,
  Banknote,
  Receipt,
  ShoppingBag,
  FileText,
  TrendingUp,
  Calculator,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface EodReport {
  date: string;
  totalRevenue: number;
  cashCollected: number;
  taxCollected: number;
  orderCount: number;
  posSessions: unknown[];
  paymentBreakdown: { cash: number; card: number; online: number };
  onlineOrders: Record<string, number>;
  returns: Record<string, number>;
}

function todayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function AccountingDashboardPage() {
  const [date, setDate] = useState(todayString);

  const { data, isLoading } = useQuery<EodReport>({
    queryKey: ["accounting-eod", date],
    queryFn: () =>
      api<EodReport>(`/api/store/admin/accounting/eod-report?date=${date}`),
  });

  const quickLinks = [
    {
      label: "EOD Report",
      href: "/admin/accounting/eod",
      icon: FileText,
      description: "End of day cashier report",
    },
    {
      label: "Revenue Reports",
      href: "/admin/accounting/revenue",
      icon: TrendingUp,
      description: "Revenue breakdown by period",
    },
    {
      label: "Tax Summary",
      href: "/admin/accounting/tax",
      icon: Calculator,
      description: "GCT collected for filing",
    },
    {
      label: "Customer Statements",
      href: "/admin/accounting/statements",
      icon: Users,
      description: "Order history by customer",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounting</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Financial overview and reporting
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-background"
        />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border rounded-md bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? "..." : formatPrice(data?.totalRevenue ?? 0)}
          </p>
        </div>
        <div className="border rounded-md bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Banknote className="h-4 w-4" />
            <span className="text-xs font-medium">Cash Collected</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? "..." : formatPrice(data?.cashCollected ?? 0)}
          </p>
        </div>
        <div className="border rounded-md bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Receipt className="h-4 w-4" />
            <span className="text-xs font-medium">Tax Collected</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? "..." : formatPrice(data?.taxCollected ?? 0)}
          </p>
        </div>
        <div className="border rounded-md bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="text-xs font-medium">Orders Today</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? "..." : (data?.orderCount ?? 0)}
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="border rounded-md bg-card p-5 hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <span className="font-medium text-sm group-hover:text-primary transition-colors">
                    {link.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {link.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
