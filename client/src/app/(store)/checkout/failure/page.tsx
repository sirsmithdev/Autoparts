"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { XCircle, Loader2, Package, AlertCircle, Clock, CreditCard } from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
}

function CheckoutFailureContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => { if (!authLoading && !isAuthenticated) router.replace("/login"); }, [authLoading, isAuthenticated, router]);

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["my-order", orderId],
    queryFn: () => api(`/api/store/orders/${orderId}`),
    enabled: isAuthenticated && !!orderId,
  });

  const retryMutation = useMutation({
    mutationFn: () => api<{ redirectData?: string }>(`/api/store/orders/${orderId}/retry-payment`, { method: "POST" }),
    onSuccess: (result) => {
      if (result.redirectData) {
        const w = window.open("", "_blank", "width=600,height=700");
        if (w) {
          w.document.write(result.redirectData);
          w.document.close();
        } else {
          setError("Payment window was blocked by your browser. Please allow popups and try again.");
        }
      } else {
        router.push(`/checkout/success?orderId=${orderId}`);
      }
    },
    onError: (err: Error) => setError(err.message || "Failed to retry payment"),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api(`/api/store/orders/${orderId}/cancel`, { method: "POST", body: JSON.stringify({ reason: "Customer cancelled after payment failure" }) }),
    onSuccess: () => router.push("/orders"),
    onError: (err: Error) => setError(err.message || "Failed to cancel order"),
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
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Checkout", href: "/checkout" }, { label: "Payment Failed" }]} />

      {/* Failure Icon & Heading */}
      <div className="text-center space-y-3 py-4">
        <XCircle className="h-16 w-16 text-red-500 mx-auto" />
        <h1 className="text-2xl font-bold">Payment Failed</h1>
        <p className="text-muted-foreground text-sm">Your payment could not be processed</p>
      </div>

      {/* Order Info */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center space-y-1">
        <p className="text-sm text-red-700 font-medium">Order {order.orderNumber}</p>
        <p className="text-xl font-bold text-red-800">{formatPrice(order.total)}</p>
      </div>

      {/* Items Reserved Notice */}
      <div className="flex items-center gap-3 p-4 border border-amber-200 rounded-lg bg-amber-50">
        <Clock className="h-5 w-5 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800">Your items are reserved for 30 minutes. Please retry payment or cancel the order.</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => { setError(""); retryMutation.mutate(); }}
          disabled={retryMutation.isPending || cancelMutation.isPending}
          className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm text-center hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {retryMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Retrying...</>
          ) : (
            <><CreditCard className="h-4 w-4" /> Try Again</>
          )}
        </button>
        <button
          onClick={() => { setError(""); cancelMutation.mutate(); }}
          disabled={retryMutation.isPending || cancelMutation.isPending}
          className="flex-1 py-3 border border-destructive/30 text-destructive rounded-lg font-semibold text-sm text-center hover:bg-destructive/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {cancelMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Cancelling...</>
          ) : (
            <><XCircle className="h-4 w-4" /> Cancel Order</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function CheckoutFailurePage() {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <CheckoutFailureContent />
    </Suspense>
  );
}
