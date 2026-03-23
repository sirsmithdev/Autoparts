"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Truck, MapPin, Store, ChevronRight, ShieldCheck, CreditCard,
  AlertCircle, Loader2, Package,
} from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

interface DeliveryZone { id: string; name: string; parishes: string[]; deliveryFee: string; oversizedSurcharge: string; estimatedDays: number }

const CHECKOUT_STEPS = [
  { num: 1, label: "Delivery" },
  { num: 2, label: "Review" },
  { num: 3, label: "Payment" },
];

export default function CheckoutPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [deliveryMethod, setDeliveryMethod] = useState<"local_delivery" | "pickup">("local_delivery");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryParish, setDeliveryParish] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!authLoading && !isAuthenticated) router.replace("/login?redirect=/checkout"); }, [authLoading, isAuthenticated, router]);

  const { data: zones = [] } = useQuery<DeliveryZone[]>({ queryKey: ["delivery-zones"], queryFn: () => api("/api/store/delivery-zones") });
  const { data: cartData, isLoading: cartLoading } = useQuery<{ items: Array<{ currentPrice: string; quantity: number; part: { name: string; isOversized?: boolean } }>; itemCount: number }>({
    queryKey: ["server-cart"],
    queryFn: () => api("/api/store/cart"),
    enabled: isAuthenticated,
  });

  const items = cartData?.items || [];
  const subtotal = items.reduce((s, i) => s + parseFloat(i.currentPrice) * i.quantity, 0);
  const selectedZone = zones.find(z => z.id === selectedZoneId);
  const hasOversized = items.some(i => i.part?.isOversized);
  const deliveryFee = deliveryMethod === "pickup" ? 0 : selectedZone
    ? parseFloat(selectedZone.deliveryFee) + (hasOversized ? parseFloat(selectedZone.oversizedSurcharge) : 0) : 0;

  const handleCheckout = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      const result = await api<{ orderId: string; orderNumber: string; total: string; redirectData?: string; spiToken?: string }>("/api/store/checkout", {
        method: "POST",
        body: JSON.stringify({ deliveryMethod, deliveryZoneId: selectedZoneId || undefined, deliveryAddress: deliveryAddress || undefined, deliveryParish: deliveryParish || undefined, deliveryNotes: deliveryNotes || undefined }),
      });

      if (result.redirectData) {
        const w = window.open("", "_blank", "width=600,height=700");
        if (w) {
          w.document.write(result.redirectData);
          w.document.close();
        } else {
          setError("Payment window was blocked by your browser. Please allow popups for this site and try again.");
          return;
        }
      } else {
        router.push(`/orders/${result.orderId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !isAuthenticated || cartLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center space-y-3">
        <Package className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="text-lg font-medium">Your cart is empty</p>
        <Link href="/search" className="text-primary hover:underline text-sm">Browse parts</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />

      {/* Coupon toggle */}
      <div className="border rounded-md p-3 text-sm text-muted-foreground">
        Have a coupon? <button className="text-primary hover:underline font-medium">Click here to enter your code</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
      {/* Left column - forms */}
      <div className="lg:col-span-2 space-y-8">

      {/* Delivery Method */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">Delivery Method</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setDeliveryMethod("local_delivery")}
            className={`relative p-5 border-2 rounded-xl text-left transition-all ${
              deliveryMethod === "local_delivery"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            <Truck className={`h-6 w-6 mb-2 ${deliveryMethod === "local_delivery" ? "text-primary" : "text-muted-foreground"}`} />
            <div className="font-semibold">Local Delivery</div>
            <p className="text-sm text-muted-foreground mt-0.5">Delivered to your door</p>
            {deliveryMethod === "local_delivery" && (
              <div className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
          <button
            onClick={() => setDeliveryMethod("pickup")}
            className={`relative p-5 border-2 rounded-xl text-left transition-all ${
              deliveryMethod === "pickup"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            <Store className={`h-6 w-6 mb-2 ${deliveryMethod === "pickup" ? "text-primary" : "text-muted-foreground"}`} />
            <div className="font-semibold">In-Store Pickup</div>
            <p className="text-sm text-muted-foreground mt-0.5">Collect at 316 Automotive</p>
            {deliveryMethod === "pickup" && (
              <div className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </section>

      {/* Delivery Address */}
      {deliveryMethod === "local_delivery" && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Delivery Address
          </h2>
          <div className="space-y-4 bg-card border rounded-xl p-5">
            <div>
              <label className="text-sm font-medium block mb-1.5">Delivery Zone / Parish</label>
              <select
                className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedZoneId}
                onChange={e => {
                  setSelectedZoneId(e.target.value);
                  const zone = zones.find(z => z.id === e.target.value);
                  if (zone) setDeliveryParish((zone.parishes as string[])[0] || "");
                }}
              >
                <option value="">Select delivery zone</option>
                {zones.map(z => (
                  <option key={z.id} value={z.id}>
                    {z.name} — {formatPrice(z.deliveryFee)} ({z.estimatedDays} day{z.estimatedDays !== 1 ? "s" : ""})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Street Address</label>
              <AddressAutocomplete
                value={deliveryAddress}
                onChange={({ address, parish }) => {
                  setDeliveryAddress(address);
                  if (parish) {
                    setDeliveryParish(parish);
                    const matchedZone = zones.find(z =>
                      (z.parishes as string[]).some(p => p.toLowerCase() === parish.toLowerCase())
                    );
                    if (matchedZone) setSelectedZoneId(matchedZone.id);
                  }
                }}
                onRawChange={(val) => setDeliveryAddress(val)}
                placeholder="Start typing your address..."
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Delivery Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={deliveryNotes}
                onChange={e => setDeliveryNotes(e.target.value)}
                placeholder="Gate code, landmarks, etc."
              />
            </div>
          </div>
        </section>
      )}

      </div>

      {/* Right column - Order Summary */}
      <div>
      <section className="border rounded-md bg-card p-6 space-y-3 sticky top-24">
        <h2 className="text-lg font-bold">Your order</h2>

        {/* Itemized list */}
        <div className="space-y-2 text-sm border-b pb-3">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="text-muted-foreground truncate">{item.part?.name || `Item ${i + 1}`} &times; {item.quantity}</span>
              <span className="font-medium shrink-0">{formatPrice(parseFloat(item.currentPrice) * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery</span>
            <span className="font-medium">{deliveryFee > 0 ? formatPrice(deliveryFee) : deliveryMethod === "pickup" ? "Free" : "Select zone"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="text-muted-foreground">Calculated by server</span>
          </div>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-4">
          <span>Total</span>
          <span>{formatPrice(subtotal + deliveryFee)}</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={isSubmitting || (deliveryMethod === "local_delivery" && (!selectedZoneId || !deliveryAddress.trim()))}
          className="w-full py-3 bg-destructive text-white rounded-md font-semibold text-sm disabled:opacity-50 hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
          ) : (
            <>Place order</>
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Secured with 256-bit encryption
        </p>
      </section>
      </div>
      </div>
    </div>
  );
}
