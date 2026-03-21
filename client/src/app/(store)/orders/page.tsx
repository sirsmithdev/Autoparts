"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { format } from "date-fns";
import { Package, ChevronRight, Truck, Store } from "lucide-react";

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  placed: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  confirmed: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  picking: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  packed: { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
  shipped: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  out_for_delivery: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  delivered: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  cancelled: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

export default function OrdersPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => { if (!authLoading && !isAuthenticated) router.replace("/login?redirect=/orders"); }, [authLoading, isAuthenticated, router]);

  const { data, isLoading } = useQuery<{ orders: Array<{ id: string; orderNumber: string; status: string; total: string; deliveryMethod: string; createdAt: string; customerName?: string }>; total: number }>({
    queryKey: ["my-orders"],
    queryFn: () => api("/api/store/orders"),
    enabled: isAuthenticated,
  });

  if (authLoading || !isAuthenticated) return null;

  const orders = data?.orders || [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My Orders" }]} />

      <h1 className="text-2xl font-bold">My Orders</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="border rounded-lg p-5">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="flex gap-4 mt-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="text-lg font-medium">No orders yet</p>
          <p className="text-sm text-muted-foreground">Once you place an order, it will appear here.</p>
          <Link href="/search" className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
            Browse Parts
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const cfg = statusConfig[order.status] || { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" };
            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="group block border rounded-lg p-5 hover:shadow-md hover:border-primary/20 transition-all bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-sm">{order.orderNumber}</span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{formatPrice(order.total)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2.5 text-sm text-muted-foreground">
                  <span>{format(new Date(order.createdAt), "MMM d, yyyy")}</span>
                  <span className="flex items-center gap-1">
                    {order.deliveryMethod === "pickup" ? <Store className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                    {order.deliveryMethod.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
