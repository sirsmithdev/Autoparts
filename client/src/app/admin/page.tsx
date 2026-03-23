"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  ShoppingBag, ClipboardList, RotateCcw, AlertTriangle,
  ArrowRight, Loader2,
} from "lucide-react";

interface OrdersResponse { orders: Array<{ id: string }>; total: number }
interface PickListsResponse { pickLists: Array<{ id: string }>; total: number }
interface ReturnsResponse { returns: Array<{ id: string }>; total: number }
interface ProductsResponse { products: Array<{ id: string }>; total: number }

function StatCard({
  title,
  count,
  isLoading,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  count: number;
  isLoading: boolean;
  icon: typeof ShoppingBag;
  href: string;
  color: string;
}) {
  return (
    <div className="border rounded-lg bg-card p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-1" />
          ) : (
            <p className="text-3xl font-bold tabular-nums">{count}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
      >
        View all <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: pendingOrders, isLoading: ordersLoading } = useQuery<OrdersResponse>({
    queryKey: ["admin-orders", "placed"],
    queryFn: () => api("/api/store/admin/orders?status=placed&limit=1"),
  });

  const { data: pickLists, isLoading: pickListsLoading } = useQuery<PickListsResponse>({
    queryKey: ["admin-pick-lists", "active"],
    queryFn: () => api("/api/store/admin/pick-lists?status=pending&limit=1"),
  });

  const { data: pendingReturns, isLoading: returnsLoading } = useQuery<ReturnsResponse>({
    queryKey: ["admin-returns", "pending"],
    queryFn: () => api("/api/store/admin/returns?status=pending&limit=1"),
  });

  const { data: lowStockProducts, isLoading: productsLoading } = useQuery<ProductsResponse>({
    queryKey: ["admin-products", "low-stock"],
    queryFn: () => api("/api/store/admin/products?stockStatus=low_stock&limit=1"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of your store activity</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Orders"
          count={pendingOrders?.total ?? 0}
          isLoading={ordersLoading}
          icon={ShoppingBag}
          href="/admin/orders?status=placed"
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Active Pick Lists"
          count={pickLists?.total ?? 0}
          isLoading={pickListsLoading}
          icon={ClipboardList}
          href="/admin/pick-lists?status=pending"
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          title="Returns Pending"
          count={pendingReturns?.total ?? 0}
          isLoading={returnsLoading}
          icon={RotateCcw}
          href="/admin/returns?status=pending"
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          title="Low Stock Products"
          count={lowStockProducts?.total ?? 0}
          isLoading={productsLoading}
          icon={AlertTriangle}
          href="/admin/products?stockStatus=low_stock"
          color="bg-red-50 text-red-600"
        />
      </div>
    </div>
  );
}
