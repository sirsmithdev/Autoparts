"use client";
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Truck, MapPin, Store, ShieldCheck, CreditCard,
  AlertCircle, Loader2, Package, Lock,
} from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

interface DeliveryZone { id: string; name: string; parishes: string[]; deliveryFee: string; oversizedSurcharge: string; estimatedDays: number }
interface SavedCard { id: string; cardBrand: string; maskedPan: string; isDefault: boolean }

const TAX_RATE = 0.15; // 15% GCT — matches store_settings default

export default function CheckoutPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [deliveryMethod, setDeliveryMethod] = useState<"local_delivery" | "pickup">("local_delivery");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryParish, setDeliveryParish] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // Payment state
  const [paymentMode, setPaymentMode] = useState<"new" | "saved">("new");
  const [cardPan, setCardPan] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [selectedCardId, setSelectedCardId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!authLoading && !isAuthenticated) router.replace("/login?redirect=/checkout"); }, [authLoading, isAuthenticated, router]);

  const { data: zones = [] } = useQuery<DeliveryZone[]>({ queryKey: ["delivery-zones"], queryFn: () => api("/api/store/delivery-zones") });
  const { data: cartData, isLoading: cartLoading } = useQuery<{ items: Array<{ currentPrice: string; quantity: number; part: { name: string; isOversized?: boolean } }>; itemCount: number }>({
    queryKey: ["server-cart"],
    queryFn: () => api("/api/store/cart"),
    enabled: isAuthenticated,
  });
  const { data: savedCards = [] } = useQuery<SavedCard[]>({
    queryKey: ["payment-methods"],
    queryFn: () => api("/api/store/payment-methods"),
    enabled: isAuthenticated,
  });

  const items = cartData?.items || [];
  const subtotal = items.reduce((s, i) => s + parseFloat(i.currentPrice) * i.quantity, 0);
  const selectedZone = zones.find(z => z.id === selectedZoneId);
  const hasOversized = items.some(i => i.part?.isOversized);
  const deliveryFee = deliveryMethod === "pickup" ? 0 : selectedZone
    ? parseFloat(selectedZone.deliveryFee) + (hasOversized ? parseFloat(selectedZone.oversizedSurcharge) : 0) : 0;
  const estimatedTax = (subtotal + deliveryFee) * TAX_RATE;
  const estimatedTotal = subtotal + deliveryFee + estimatedTax;

  // Listen for 3DS postMessage callback
  const handle3DSCallback = useCallback((event: MessageEvent) => {
    if (event.data?.type === "powertranz-callback") {
      const { orderId, success } = event.data;
      if (success && orderId) {
        router.push(`/orders/${orderId}`);
      } else {
        setError("Payment was not completed. Please try again.");
        setIsSubmitting(false);
      }
    }
  }, [router]);

  useEffect(() => {
    window.addEventListener("message", handle3DSCallback);
    return () => window.removeEventListener("message", handle3DSCallback);
  }, [handle3DSCallback]);

  const handleCheckout = async () => {
    setError("");

    // Validate payment info
    if (paymentMode === "new") {
      if (!cardPan || cardPan.replace(/\s/g, "").length < 13) { setError("Enter a valid card number"); return; }
      if (!cardCvv || cardCvv.length < 3) { setError("Enter CVV"); return; }
      if (!cardExpiry || cardExpiry.length < 4) { setError("Enter expiry (MMYY)"); return; }
      if (!cardholderName.trim()) { setError("Enter cardholder name"); return; }
    } else if (paymentMode === "saved" && !selectedCardId) {
      setError("Select a saved card"); return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        deliveryMethod,
        deliveryZoneId: selectedZoneId || undefined,
        deliveryAddress: deliveryAddress || undefined,
        deliveryParish: deliveryParish || undefined,
        deliveryNotes: deliveryNotes || undefined,
      };

      if (paymentMode === "saved" && selectedCardId) {
        payload.paymentMethodId = selectedCardId;
      } else {
        payload.cardDetails = {
          cardPan: cardPan.replace(/\s/g, ""),
          cardCvv,
          cardExpiration: cardExpiry.replace(/\//g, ""),
          cardholderName: cardholderName.trim(),
        };
      }

      const result = await api<{
        orderId: string; orderNumber: string; total: string;
        redirectData?: string; spiToken?: string; requiresPayment?: boolean;
      }>("/api/store/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (result.redirectData) {
        // Open 3DS challenge in popup
        const w = window.open("", "3ds_challenge", "width=600,height=700,scrollbars=yes");
        if (w) {
          w.document.write(result.redirectData);
          w.document.close();
        } else {
          setError("Payment popup was blocked. Please allow popups for this site and try again.");
          setIsSubmitting(false);
        }
        // The postMessage listener will handle the callback
      } else if (result.requiresPayment) {
        setError("Payment could not be initiated. Please check your card details and try again.");
        setIsSubmitting(false);
      } else {
        // Direct approval (no 3DS needed)
        router.push(`/orders/${result.orderId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
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

  const canSubmit = deliveryMethod === "pickup" || (selectedZoneId && deliveryAddress.trim());
  const hasPayment = paymentMode === "saved" ? !!selectedCardId : (cardPan.replace(/\s/g, "").length >= 13 && cardCvv.length >= 3 && cardExpiry.length >= 4 && cardholderName.trim());

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />

      <div className="grid lg:grid-cols-3 gap-8">
      {/* Left column - forms */}
      <div className="lg:col-span-2 space-y-8">

      {/* Delivery Method */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">1. Delivery Method</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setDeliveryMethod("local_delivery")}
            className={`relative p-5 border-2 rounded-md text-left transition-all ${
              deliveryMethod === "local_delivery"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            <Truck className={`h-6 w-6 mb-2 ${deliveryMethod === "local_delivery" ? "text-primary" : "text-muted-foreground"}`} />
            <div className="font-semibold">Local Delivery</div>
            <p className="text-sm text-muted-foreground mt-0.5">Delivered to your door</p>
          </button>
          <button
            onClick={() => setDeliveryMethod("pickup")}
            className={`relative p-5 border-2 rounded-md text-left transition-all ${
              deliveryMethod === "pickup"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            <Store className={`h-6 w-6 mb-2 ${deliveryMethod === "pickup" ? "text-primary" : "text-muted-foreground"}`} />
            <div className="font-semibold">In-Store Pickup</div>
            <p className="text-sm text-muted-foreground mt-0.5">Collect at 316 Automotive</p>
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
          <div className="space-y-4 bg-card border rounded-md p-5">
            <div>
              <label className="text-sm font-medium block mb-1.5">Delivery Zone / Parish <span className="text-destructive">*</span></label>
              <select
                className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
              <label className="text-sm font-medium block mb-1.5">Street Address <span className="text-destructive">*</span></label>
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
                className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={deliveryNotes}
                onChange={e => setDeliveryNotes(e.target.value)}
                placeholder="Gate code, landmarks, etc."
              />
            </div>
          </div>
        </section>
      )}

      {/* Payment */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          2. Payment
        </h2>
        <div className="bg-card border rounded-md p-5 space-y-4">
          {/* Saved cards */}
          {savedCards.length > 0 && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={() => setPaymentMode("saved")}
                  className={`flex-1 p-3 border-2 rounded-md text-sm font-medium transition-all ${
                    paymentMode === "saved" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  Saved Card
                </button>
                <button
                  onClick={() => setPaymentMode("new")}
                  className={`flex-1 p-3 border-2 rounded-md text-sm font-medium transition-all ${
                    paymentMode === "new" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  New Card
                </button>
              </div>
              {paymentMode === "saved" && (
                <select
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a saved card</option>
                  {savedCards.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.cardBrand} •••• {c.maskedPan.slice(-4)} {c.isDefault ? "(default)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* New card form */}
          {(paymentMode === "new" || savedCards.length === 0) && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Card Number <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={19}
                  value={cardPan}
                  onChange={(e) => setCardPan(e.target.value.replace(/[^\d\s]/g, ""))}
                  placeholder="1234 5678 9012 3456"
                  className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Expiry <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => {
                      let v = e.target.value.replace(/[^\d]/g, "");
                      if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                      setCardExpiry(v.slice(0, 5));
                    }}
                    placeholder="MM/YY"
                    className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">CVV <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                    placeholder="123"
                    className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">&nbsp;</label>
                  <div className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    Encrypted
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Cardholder Name <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  placeholder="Name on card"
                  className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}
        </div>
      </section>

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
            <span className="text-muted-foreground">Tax (GCT 15%)</span>
            <span className="font-medium">{formatPrice(estimatedTax)}</span>
          </div>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-4">
          <span>Total</span>
          <span>{formatPrice(estimatedTotal)}</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={isSubmitting || !canSubmit || !hasPayment}
          className="w-full py-3 bg-primary text-white rounded-md font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processing payment...</>
          ) : (
            <><CreditCard className="h-4 w-4" /> Pay {formatPrice(estimatedTotal)}</>
          )}
        </button>

        {!isSubmitting && (!canSubmit || !hasPayment) && (
          <p className="text-center text-xs text-muted-foreground">
            Please fill in all delivery and payment details to continue.
          </p>
        )}

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
