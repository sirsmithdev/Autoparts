"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { CheckCircle2, Loader2, Package, Mail } from "lucide-react";

interface OrderItem {
  id: string;
  productName: string;
  productNumber: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  subtotal: string;
  taxAmount: string;
  deliveryFee: string;
  items: OrderItem[];
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => { if (!authLoading && !isAuthenticated) router.replace("/login"); }, [authLoading, isAuthenticated, router]);

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["my-order", orderId],
    queryFn: () => api(`/api/store/orders/${orderId}`),
    enabled: isAuthenticated && !!orderId,
  });

  if (authLoading || !isAuthenticated || isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-16 w-16 rounded-full mx-auto" />
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center space-y-3">
        <Package className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="text-lg font-medium">Order not found</p>
        <Link href="/orders" className="text-primary hover:underline text-sm">View all orders</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Checkout", href: "/checkout" }, { label: "Confirmation" }]} />

      {/* Success Icon & Heading */}
      <div className="text-center space-y-3 py-4">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
        <h1 className="text-2xl font-bold">Order Placed Successfully!</h1>
        <p className="text-muted-foreground text-sm">Thank you for your order</p>
      </div>

      {/* Order Number */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
        <p className="text-sm text-green-700 font-medium">Order Number</p>
        <p className="text-xl font-bold text-green-800 mt-1">{order.orderNumber}</p>
      </div>

      {/* Confirmation Email */}
      <div className="flex items-center gap-3 p-4 border rounded-lg bg-card">
        <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">A confirmation email has been sent to your email address.</p>
      </div>

      {/* Order Summary */}
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="px-5 py-3 bg-muted/50 border-b">
          <h2 className="font-semibold text-sm">Order Summary ({order.items.length} item{order.items.length !== 1 ? "s" : ""})</h2>
        </div>
        <div className="divide-y">
          {order.items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium line-clamp-1">{item.productName}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.productNumber}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium">{formatPrice(item.lineTotal)}</p>
                <p className="text-xs text-muted-foreground">{item.quantity} x {formatPrice(item.unitPrice)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t p-5 space-y-2 text-sm bg-muted/30">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatPrice(order.taxAmount)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{parseFloat(order.deliveryFee) > 0 ? formatPrice(order.deliveryFee) : "Free"}</span></div>
          <div className="flex justify-between font-bold text-base border-t pt-3"><span>Total</span><span>{formatPrice(order.total)}</span></div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/orders/${order.id}`}
          className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm text-center hover:bg-primary/90 transition-colors"
        >
          View Order
        </Link>
        <Link
          href="/search"
          className="flex-1 py-3 border rounded-lg font-semibold text-sm text-center hover:bg-accent transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
