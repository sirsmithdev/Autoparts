"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { QrCode, Search, CheckCircle2, Package, AlertCircle, Loader2 } from "lucide-react";

interface PickupOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  pickupReadyAt: string | null;
  pickedUpAt: string | null;
  total: string;
  items: Array<{ productName: string; quantity: number; unitPrice: string }>;
}

export default function ScanPickupPage() {
  const [code, setCode] = useState("");
  const [order, setOrder] = useState<PickupOrder | null>(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleLookup = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || trimmed.length < 4) {
      setError("Enter a valid pickup code");
      return;
    }
    setError("");
    setOrder(null);
    setConfirmed(false);
    setSearching(true);
    try {
      const result = await api<PickupOrder>("/api/store/admin/orders/verify-pickup", {
        method: "POST",
        body: JSON.stringify({ code: trimmed }),
      });
      setOrder(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order not found");
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmPickup = async () => {
    if (!order) return;
    setConfirming(true);
    try {
      await api(`/api/store/admin/orders/${order.id}/picked-up`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm pickup");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scan Pickup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the customer&apos;s pickup code or scan their QR code to verify and complete the pickup.
        </p>
      </div>

      {/* Code entry */}
      <div className="border rounded-md bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <QrCode className="h-8 w-8 text-primary shrink-0" />
          <div>
            <p className="font-semibold text-sm">Pickup Code</p>
            <p className="text-xs text-muted-foreground">Enter the 8-character code from the customer&apos;s email or order page</p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="e.g. A7K2M9X1"
            maxLength={8}
            className="flex-1 border rounded-md px-4 py-3 text-lg font-mono tracking-[0.3em] text-center uppercase bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <button
            onClick={handleLookup}
            disabled={searching || code.trim().length < 4}
            className="px-5 py-3 bg-primary text-white rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Look Up
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Order details */}
      {order && !confirmed && (
        <div className="border rounded-md bg-card overflow-hidden">
          <div className="p-4 bg-muted/40 border-b flex items-center justify-between">
            <div>
              <p className="font-bold">Order {order.orderNumber}</p>
              <p className="text-sm text-muted-foreground">{order.customerName} &middot; {order.customerEmail}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              order.pickedUpAt
                ? "bg-gray-100 text-gray-600"
                : order.pickupReadyAt
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
            }`}>
              {order.pickedUpAt ? "Already Collected" : order.pickupReadyAt ? "Ready for Pickup" : order.status}
            </span>
          </div>

          {/* Items */}
          <div className="p-4 space-y-2">
            {order.items?.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{item.productName} &times; {item.quantity}</span>
                </div>
                <span className="font-medium">{formatPrice(item.unitPrice)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t font-bold">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>

          {/* Confirm button */}
          {!order.pickedUpAt && order.pickupReadyAt && (
            <div className="p-4 border-t">
              <button
                onClick={handleConfirmPickup}
                disabled={confirming}
                className="w-full py-3 bg-green-600 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {confirming ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Confirming...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Confirm Pickup &mdash; Hand Over Items</>
                )}
              </button>
            </div>
          )}

          {order.pickedUpAt && (
            <div className="p-4 border-t bg-gray-50 text-center text-sm text-muted-foreground">
              This order was already collected.
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {confirmed && order && (
        <div className="border rounded-md bg-green-50 p-6 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
          <p className="text-lg font-bold text-green-800">Pickup Complete</p>
          <p className="text-sm text-green-700">
            Order {order.orderNumber} has been handed to {order.customerName}.
          </p>
          <button
            onClick={() => { setOrder(null); setCode(""); setConfirmed(false); }}
            className="px-6 py-2 border border-green-300 text-green-700 rounded-md text-sm font-medium hover:bg-green-100 transition-colors"
          >
            Scan Next Order
          </button>
        </div>
      )}
    </div>
  );
}
