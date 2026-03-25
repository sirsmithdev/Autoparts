"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Search,
  User,
  Mail,
  Phone,
  DollarSign,
  ShoppingBag,
  RotateCcw,
  CreditCard,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface CustomerResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  total: string;
  status: string;
  paymentStatus: string;
}

interface CustomerReturn {
  id: string;
  returnNumber: string;
  createdAt: string;
  refundAmount: string;
  status: string;
}

interface CustomerStatement {
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    storeCreditBalance: number;
  };
  orders: CustomerOrder[];
  returns: CustomerReturn[];
  summary: {
    totalSpent: number;
    totalRefunded: number;
    orderCount: number;
    storeCreditBalance: number;
  };
}

function defaultStartDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  placed: { bg: "bg-blue-50", text: "text-blue-700" },
  confirmed: { bg: "bg-indigo-50", text: "text-indigo-700" },
  shipped: { bg: "bg-orange-50", text: "text-orange-700" },
  delivered: { bg: "bg-green-50", text: "text-green-700" },
  cancelled: { bg: "bg-red-50", text: "text-red-700" },
  pending: { bg: "bg-yellow-50", text: "text-yellow-700" },
  paid: { bg: "bg-green-50", text: "text-green-700" },
  refunded: { bg: "bg-purple-50", text: "text-purple-700" },
  approved: { bg: "bg-teal-50", text: "text-teal-700" },
  requested: { bg: "bg-amber-50", text: "text-amber-700" },
};

export default function CustomerStatementsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(todayString);

  const { data: searchResults } = useQuery<{ customers: CustomerResult[] }>({
    queryKey: ["customer-search", searchTerm],
    queryFn: () =>
      api<{ customers: CustomerResult[] }>(
        `/api/store/admin/customers?search=${encodeURIComponent(searchTerm)}`
      ),
    enabled: searchTerm.length >= 2,
  });

  const { data: statement, isLoading: statementLoading } = useQuery<CustomerStatement>({
    queryKey: ["customer-statement", selectedCustomerId, startDate, endDate],
    queryFn: () =>
      api<CustomerStatement>(
        `/api/store/admin/accounting/customer-statement/${selectedCustomerId}?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!selectedCustomerId,
  });

  const customers = searchResults?.customers ?? [];

  function getStatusBadge(status: string) {
    const cfg = statusConfig[status] || { bg: "bg-gray-50", text: "text-gray-700" };
    return (
      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
        {status.replace(/_/g, " ")}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customer Statements</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Order history and account summary by customer
        </p>
      </div>

      {/* Customer Search */}
      <div className="border rounded-md bg-card p-5">
        <label className="text-sm font-medium mb-2 block">Search Customer</label>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (e.target.value.length < 2) setSelectedCustomerId(null);
            }}
          />
        </div>

        {/* Search Results */}
        {searchTerm.length >= 2 && customers.length > 0 && !selectedCustomerId && (
          <div className="mt-3 border rounded-md divide-y max-h-60 overflow-auto">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedCustomerId(c.id);
                  setSearchTerm(
                    [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email
                  );
                }}
                className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors text-sm"
              >
                <p className="font-medium">
                  {[c.firstName, c.lastName].filter(Boolean).join(" ") || "No name"}
                </p>
                <p className="text-xs text-muted-foreground">{c.email}</p>
              </button>
            ))}
          </div>
        )}

        {searchTerm.length >= 2 && customers.length === 0 && !selectedCustomerId && (
          <p className="mt-3 text-sm text-muted-foreground">No customers found.</p>
        )}
      </div>

      {/* Date Range Filter */}
      {selectedCustomerId && (
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
      )}

      {/* Statement Content */}
      {statementLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading statement...</div>
      )}

      {statement && (
        <>
          {/* Customer Info Card */}
          <div className="border rounded-md bg-card p-5">
            <h2 className="text-lg font-semibold mb-3">Customer Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">
                    {[statement.customer.firstName, statement.customer.lastName]
                      .filter(Boolean)
                      .join(" ") || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{statement.customer.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{statement.customer.phone || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Store Credit</p>
                  <p className="text-sm font-medium">
                    {formatPrice(statement.customer.storeCreditBalance)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border rounded-md bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium">Total Spent</span>
              </div>
              <p className="text-2xl font-bold">{formatPrice(statement.summary.totalSpent)}</p>
            </div>
            <div className="border rounded-md bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <RotateCcw className="h-4 w-4" />
                <span className="text-xs font-medium">Total Refunded</span>
              </div>
              <p className="text-2xl font-bold">{formatPrice(statement.summary.totalRefunded)}</p>
            </div>
            <div className="border rounded-md bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <ShoppingBag className="h-4 w-4" />
                <span className="text-xs font-medium">Order Count</span>
              </div>
              <p className="text-2xl font-bold">{statement.summary.orderCount}</p>
            </div>
            <div className="border rounded-md bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-xs font-medium">Store Credit</span>
              </div>
              <p className="text-2xl font-bold">
                {formatPrice(statement.summary.storeCreditBalance)}
              </p>
            </div>
          </div>

          {/* Orders Table */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Orders</h2>
            <div className="border rounded-md bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left p-3 font-medium text-muted-foreground">Order #</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-muted-foreground">
                          No orders in this period
                        </td>
                      </tr>
                    ) : (
                      statement.orders.map((order) => (
                        <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-mono text-xs font-semibold">{order.orderNumber}</td>
                          <td className="p-3 text-muted-foreground">
                            {format(new Date(order.createdAt), "MMM d, yyyy")}
                          </td>
                          <td className="p-3 text-right font-medium">{formatPrice(order.total)}</td>
                          <td className="p-3">{getStatusBadge(order.status)}</td>
                          <td className="p-3">{getStatusBadge(order.paymentStatus)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Returns Table */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Returns</h2>
            <div className="border rounded-md bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left p-3 font-medium text-muted-foreground">Return #</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Refund Amount</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.returns.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-muted-foreground">
                          No returns in this period
                        </td>
                      </tr>
                    ) : (
                      statement.returns.map((ret) => (
                        <tr key={ret.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-mono text-xs font-semibold">{ret.returnNumber}</td>
                          <td className="p-3 text-muted-foreground">
                            {format(new Date(ret.createdAt), "MMM d, yyyy")}
                          </td>
                          <td className="p-3 text-right font-medium">{formatPrice(ret.refundAmount)}</td>
                          <td className="p-3">{getStatusBadge(ret.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
