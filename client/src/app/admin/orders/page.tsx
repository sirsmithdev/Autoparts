"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, Eye, Package, DollarSign, TrendingUp, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface OrderStats {
  ordersByStatus: Record<string, number>;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  returnRate: number;
}

interface StoreOrder {
  id: string;
  orderNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  deliveryMethod: string;
  total: string;
  createdAt: string | null;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  pending_payment: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  placed: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  confirmed: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  picking: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  packed: { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
  shipped: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  out_for_delivery: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  delivered: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  cancelled: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  refund_pending: { bg: "bg-pink-50", text: "text-pink-700", dot: "bg-pink-500" },
};

export default function AdminOrdersPage() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery<OrderStats>({
    queryKey: ["admin-stats"],
    queryFn: () => api<OrderStats>("/api/store/admin/stats"),
  });

  const { data: ordersData, isLoading } = useQuery<{ orders: StoreOrder[]; total: number }>({
    queryKey: ["admin-orders", status, search, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      params.set("page", String(page));
      return api<{ orders: StoreOrder[]; total: number }>(`/api/store/admin/orders?${params}`);
    },
  });

  const orders = ordersData?.orders || [];
  const total = ordersData?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Online Orders</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage parts store orders and fulfillment</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Total Orders</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalOrders}</p>
          </div>
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Revenue</span>
            </div>
            <p className="text-2xl font-bold">{formatPrice(stats.totalRevenue)}</p>
          </div>
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Avg Order</span>
            </div>
            <p className="text-2xl font-bold">{formatPrice(stats.avgOrderValue)}</p>
          </div>
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <RotateCcw className="h-4 w-4" />
              <span className="text-xs font-medium">Return Rate</span>
            </div>
            <p className="text-2xl font-bold">{stats.returnRate}%</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search orders..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Statuses</option>
          <option value="placed">Placed</option>
          <option value="confirmed">Confirmed</option>
          <option value="picking">Picking</option>
          <option value="packed">Packed</option>
          <option value="shipped">Shipped</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Order #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Delivery</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No orders found</td></tr>
              ) : orders.map((order) => {
                const cfg = statusConfig[order.status] || { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" };
                return (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs font-semibold">{order.orderNumber}</td>
                    <td className="p-3">{order.customerName || "\u2014"}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3 capitalize text-muted-foreground">{order.deliveryMethod.replace(/_/g, " ")}</td>
                    <td className="p-3 text-right font-medium">{formatPrice(order.total)}</td>
                    <td className="p-3 text-muted-foreground">{order.createdAt ? format(new Date(order.createdAt), "MMM d, yyyy") : "\u2014"}</td>
                    <td className="p-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="p-1.5 hover:bg-accent rounded transition-colors inline-flex"
                        title="View order"
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="inline-flex items-center gap-1 px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-sm text-muted-foreground px-3">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="inline-flex items-center gap-1 px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
