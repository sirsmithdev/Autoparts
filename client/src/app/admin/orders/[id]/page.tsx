"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle, Package, Truck, MapPin, X,
  User, Phone, Mail, FileText, Copy, Store, Loader2, CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { OrderTimeline } from "@/components/OrderTimeline";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface OrderItem {
  id: string;
  productName: string;
  productNumber: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

interface OrderWithItems {
  id: string;
  orderNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  deliveryMethod: string;
  deliveryParish: string | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  deliveryFee: string;
  trackingNumber: string | null;
  pickupReadyAt: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  staffNotes: string | null;
  createdAt: string | null;
  paymentTransactionId: string | null;
  paymentStatus: string | null;
  pickListId: string | null;
  items: OrderItem[];
}

const ORDER_STEPS = [
  { key: "placed", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "picking", label: "Picking" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [shipDialog, setShipDialog] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [pickupDialog, setPickupDialog] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [pickedUpBy, setPickedUpBy] = useState("");

  // Close dialogs on Escape key
  const closeAllDialogs = useCallback(() => {
    setShipDialog(false);
    setCancelDialog(false);
    setPickupDialog(false);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeAllDialogs(); };
    if (shipDialog || cancelDialog || pickupDialog) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [shipDialog, cancelDialog, pickupDialog, closeAllDialogs]);

  const { data: order, isLoading } = useQuery<OrderWithItems>({
    queryKey: ["admin-order", orderId],
    queryFn: () => api<OrderWithItems>(`/api/store/admin/orders/${orderId}`),
    enabled: !!orderId,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, body }: { action: string; body?: Record<string, unknown> }) => {
      return api(`/api/store/admin/orders/${orderId}/${action}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
      toast({ title: "Order updated" });
      setShipDialog(false);
      setCancelDialog(false);
      setPickupDialog(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 space-y-3">
        <Package className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="text-muted-foreground">Order not found</p>
        <Link href="/admin/orders" className="text-primary hover:underline text-sm">Back to Orders</Link>
      </div>
    );
  }

  const currentStep = ORDER_STEPS.findIndex(s => s.key === order.status);
  const isDelivery = order.deliveryMethod === "local_delivery";
  const isCancelled = order.status === "cancelled";

  const timelineSteps = ORDER_STEPS.map(s => ({ label: s.label, timestamp: null }));

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {order.customerName} &middot; {order.createdAt ? format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a") : ""}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
          isCancelled ? "bg-red-50 text-red-700" : "bg-primary/10 text-primary"
        }`}>
          {isCancelled && <X className="h-3.5 w-3.5" />}
          {order.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Status Timeline */}
      {!isCancelled && (
        <div className="border rounded-md bg-card p-6">
          <OrderTimeline
            steps={timelineSteps}
            currentStepIndex={currentStep >= 0 ? currentStep : 0}
            orientation="horizontal"
          />
        </div>
      )}

      {/* Action Buttons */}
      {!isCancelled && order.status !== "delivered" && (
        <div className="flex gap-2 flex-wrap">
          {order.status === "placed" && (
            <button onClick={() => actionMutation.mutate({ action: "confirm" })} disabled={actionMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <CheckCircle className="h-4 w-4" /> Confirm Order
            </button>
          )}
          {order.status === "confirmed" && (
            <button onClick={() => actionMutation.mutate({ action: "pick" })} disabled={actionMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <Package className="h-4 w-4" /> Start Picking
            </button>
          )}
          {order.status === "picking" && (
            <button onClick={() => actionMutation.mutate({ action: "pack" })} disabled={actionMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <Package className="h-4 w-4" /> Mark Packed
            </button>
          )}
          {order.status === "packed" && isDelivery && (
            <button onClick={() => setShipDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Truck className="h-4 w-4" /> Ship Order
            </button>
          )}
          {order.status === "packed" && !isDelivery && (
            <>
              <button onClick={() => actionMutation.mutate({ action: "ready-for-pickup" })} disabled={actionMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                <MapPin className="h-4 w-4" /> Ready for Pickup
              </button>
              {order.pickupReadyAt && (
                <button onClick={() => setPickupDialog(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
                  Mark Picked Up
                </button>
              )}
            </>
          )}
          {(order.status === "shipped" || order.status === "out_for_delivery") && (
            <button onClick={() => actionMutation.mutate({ action: "deliver" })} disabled={actionMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <CheckCircle className="h-4 w-4" /> Mark Delivered
            </button>
          )}
          {["placed", "confirmed", "picking"].includes(order.status) && (
            <button onClick={() => setCancelDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-destructive/30 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 transition-colors">
              <X className="h-4 w-4" /> Cancel
            </button>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Items */}
        <div className="border rounded-md bg-card overflow-hidden">
          <div className="px-5 py-3 bg-muted/40 border-b">
            <h2 className="font-semibold text-sm">Items ({order.items?.length || 0})</h2>
          </div>
          <div className="divide-y">
            {order.items?.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{item.productName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{item.productNumber}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">{formatPrice(item.lineTotal)}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity} x {formatPrice(item.unitPrice)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-4 space-y-1.5 text-sm bg-muted/30">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatPrice(order.taxAmount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatPrice(order.deliveryFee)}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>{formatPrice(order.total)}</span></div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="space-y-4">
          {/* Delivery */}
          <div className="border rounded-md bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              {isDelivery ? <Truck className="h-4 w-4 text-primary" /> : <Store className="h-4 w-4 text-primary" />}
              Delivery
            </h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex gap-2"><span className="text-muted-foreground shrink-0 w-16">Method:</span><span className="capitalize">{order.deliveryMethod.replace(/_/g, " ")}</span></div>
              {order.deliveryParish && <div className="flex gap-2"><span className="text-muted-foreground shrink-0 w-16">Parish:</span><span>{order.deliveryParish}</span></div>}
              {order.deliveryAddress && <div className="flex gap-2"><span className="text-muted-foreground shrink-0 w-16">Address:</span><span>{order.deliveryAddress}</span></div>}
              {order.deliveryNotes && <div className="flex gap-2"><span className="text-muted-foreground shrink-0 w-16">Notes:</span><span className="text-muted-foreground">{order.deliveryNotes}</span></div>}
              {order.trackingNumber && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-accent/50 rounded-lg">
                  <span className="text-xs text-muted-foreground">Tracking:</span>
                  <span className="font-mono text-xs font-medium">{order.trackingNumber}</span>
                  <button onClick={() => navigator.clipboard.writeText(order.trackingNumber!)} className="p-1 hover:bg-accent rounded" title="Copy">
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Customer */}
          <div className="border rounded-md bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Customer
            </h3>
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">{order.customerName}</p>
              {order.customerEmail && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {order.customerEmail}
                </p>
              )}
              {order.customerPhone && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {order.customerPhone}
                </p>
              )}
            </div>
          </div>

          {/* Payment */}
          {(order.paymentTransactionId || order.paymentStatus) && (
            <div className="border rounded-md bg-card p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Payment
              </h3>
              <div className="space-y-1.5 text-sm">
                {order.paymentStatus && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground shrink-0 w-20">Status:</span>
                    <span className={`capitalize font-medium ${
                      order.paymentStatus === "paid" ? "text-green-600" :
                      order.paymentStatus === "refunded" ? "text-amber-600" :
                      order.paymentStatus === "voided" ? "text-red-600" :
                      "text-muted-foreground"
                    }`}>{order.paymentStatus}</span>
                  </div>
                )}
                {order.paymentTransactionId && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0 w-20">Transaction:</span>
                    <span className="font-mono text-xs">{order.paymentTransactionId}</span>
                    <button onClick={() => navigator.clipboard.writeText(order.paymentTransactionId!)} className="p-1 hover:bg-accent rounded" title="Copy">
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pick List */}
          {order.pickListId && (
            <div className="border rounded-md bg-card p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Pick List
              </h3>
              <Link
                href={`/admin/pick-lists/${order.pickListId}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                View Pick List &rarr;
              </Link>
            </div>
          )}

          {/* Staff Notes */}
          <div className="border rounded-md bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Staff Notes
            </h3>
            <textarea
              defaultValue={order.staffNotes || ""}
              placeholder="Add internal notes..."
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y"
              onBlur={(e) => {
                if (e.target.value !== (order.staffNotes || "")) {
                  api(`/api/store/admin/orders/${orderId}/notes`, {
                    method: "PATCH",
                    body: JSON.stringify({ notes: e.target.value }),
                  })
                    .then(() => queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] }))
                    .catch(() => toast({ title: "Error", description: "Failed to save notes", variant: "destructive" }));
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Ship Dialog */}
      {shipDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShipDialog(false)}>
          <div role="dialog" aria-modal="true" className="bg-card border rounded-md p-6 w-full max-w-sm shadow-lg space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Ship Order</h3>
            <input
              placeholder="Tracking number"
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShipDialog(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
              <button
                onClick={() => actionMutation.mutate({ action: "ship", body: { trackingNumber } })}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Ship
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      {cancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCancelDialog(false)}>
          <div role="dialog" aria-modal="true" className="bg-card border rounded-md p-6 w-full max-w-sm shadow-lg space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Cancel Order</h3>
            <textarea
              placeholder="Reason for cancellation"
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelDialog(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">Back</button>
              <button
                onClick={() => actionMutation.mutate({ action: "cancel", body: { reason: cancelReason } })}
                disabled={!cancelReason || actionMutation.isPending}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pickup Dialog */}
      {pickupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPickupDialog(false)}>
          <div role="dialog" aria-modal="true" className="bg-card border rounded-md p-6 w-full max-w-sm shadow-lg space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Customer Pickup</h3>
            <input
              placeholder="Collected by (name)"
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={pickedUpBy}
              onChange={(e) => setPickedUpBy(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPickupDialog(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
              <button
                onClick={() => actionMutation.mutate({ action: "picked-up", body: { pickedUpBy } })}
                disabled={!pickedUpBy || actionMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Confirm Pickup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
