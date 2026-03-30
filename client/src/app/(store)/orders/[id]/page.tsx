"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { OrderTimeline } from "@/components/OrderTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { ArrowLeft, Truck, Store, MapPin, Package as PackageIcon, XCircle, RotateCcw, Copy, AlertCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

function PickupQRCode({ code }: { code: string }) {
  return <QRCodeSVG value={code} size={160} level="M" />;
}

const ORDER_STEPS = [
  { key: "placed", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "picking", label: "Picking" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => { if (!authLoading && !isAuthenticated) router.replace("/login"); }, [authLoading, isAuthenticated, router]);

  const { data: order, isLoading } = useQuery<{
    id: string; orderNumber: string; status: string; total: string; subtotal: string; taxAmount: string; deliveryFee: string;
    deliveryMethod: string; deliveryParish?: string; deliveryAddress?: string; trackingNumber?: string; createdAt: string;
    placedAt?: string; deliveredAt?: string; pickupReadyAt?: string; pickupCode?: string;
    items: Array<{ id: string; productId: string; productName: string; productNumber: string; quantity: number; unitPrice: string; lineTotal: string }>;
  }>({
    queryKey: ["my-order", id],
    queryFn: () => api(`/api/store/orders/${id}`),
    enabled: isAuthenticated && !!id,
  });

  const [cancelError, setCancelError] = useState("");
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelMutation = useMutation({
    mutationFn: () => api(`/api/store/orders/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "Customer cancelled" }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-order", id] }),
    onError: (err: Error) => setCancelError(err.message || "Failed to cancel order"),
  });

  if (authLoading || !isAuthenticated || isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center space-y-3">
        <PackageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="text-lg font-medium">Order not found</p>
        <Link href="/orders" className="text-primary hover:underline text-sm">View all orders</Link>
      </div>
    );
  }

  const currentStep = ORDER_STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === "cancelled";

  const timelineSteps = ORDER_STEPS.map(s => ({
    label: s.label,
    timestamp: s.key === "placed" && order.placedAt
      ? format(new Date(order.placedAt), "MMM d, h:mm a")
      : s.key === "delivered" && order.deliveredAt
        ? format(new Date(order.deliveredAt), "MMM d, h:mm a")
        : null,
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Orders", href: "/orders" }, { label: order.orderNumber }]} />

      <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Placed {format(new Date(order.createdAt), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        {isCancelled ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-red-50 text-red-700">
            <XCircle className="h-3.5 w-3.5" /> Cancelled
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary">
            {order.status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Order Timeline */}
      {!isCancelled && (
        <div className="border rounded-xl bg-card p-6">
          <OrderTimeline
            steps={timelineSteps}
            currentStepIndex={currentStep >= 0 ? currentStep : 0}
            orientation="horizontal"
          />
        </div>
      )}

      {/* Tracking & Pickup notices */}
      {order.trackingNumber && (
        <div className="flex items-center gap-3 p-4 border rounded-lg bg-accent/50">
          <Truck className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Tracking Number</p>
            <p className="text-sm font-mono text-muted-foreground">{order.trackingNumber}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(order.trackingNumber!);
              setCopied(true);
              clearTimeout(copiedTimer.current);
              copiedTimer.current = setTimeout(() => setCopied(false), 2000);
            }}
            className="p-1.5 hover:bg-accent rounded transition-colors text-sm"
            title="Copy tracking number"
          >
            {copied ? <span className="text-xs font-medium text-green-600 px-1">Copied!</span> : <Copy className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      )}
      {order.pickupReadyAt && order.deliveryMethod === "pickup" && (
        <div className="border border-green-200 rounded-lg bg-green-50 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm font-medium text-green-800">Your order is ready for pickup at 316 Automotive!</p>
          </div>
          {order.pickupCode && (
            <div className="flex flex-col items-center gap-3 py-4 bg-white rounded-md border">
              <p className="text-xs text-muted-foreground">Show this code at the pickup counter</p>
              <p className="text-3xl font-bold tracking-[0.3em] font-mono">{order.pickupCode}</p>
              <PickupQRCode code={order.pickupCode} />
            </div>
          )}
        </div>
      )}

      {/* Delivery Info */}
      {order.deliveryMethod === "local_delivery" && order.deliveryAddress && (
        <div className="flex items-start gap-3 p-4 border rounded-lg bg-card">
          <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Delivery Address</p>
            <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
            {order.deliveryParish && <p className="text-sm text-muted-foreground">{order.deliveryParish}</p>}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="px-5 py-3 bg-muted/50 border-b">
          <h2 className="font-semibold text-sm">Items ({order.items.length})</h2>
        </div>
        <div className="divide-y">
          {order.items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 gap-4">
              <div className="min-w-0">
                <Link href={`/parts/${item.productId}`} className="text-sm font-medium hover:text-primary transition-colors line-clamp-1">
                  {item.productName}
                </Link>
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

      {/* Actions */}
      {cancelError && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {cancelError}
        </div>
      )}
      <div className="flex gap-3">
        {order.status === "placed" && (
          <button
            onClick={() => { if (!window.confirm("Are you sure you want to cancel this order?")) return; setCancelError(""); cancelMutation.mutate(); }}
            disabled={cancelMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-destructive/30 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            {cancelMutation.isPending ? "Cancelling..." : "Cancel Order"}
          </button>
        )}
        {order.status === "delivered" && (
          <Link
            href={`/returns/new?orderId=${order.id}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Request Return
          </Link>
        )}
      </div>
    </div>
  );
}
