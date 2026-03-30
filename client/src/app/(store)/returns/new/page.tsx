"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, RotateCcw, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const RETURN_REASONS = [
  { value: "wrong_part", label: "Wrong part sent" },
  { value: "defective", label: "Defective / Not working" },
  { value: "not_needed", label: "No longer needed" },
  { value: "wrong_fitment", label: "Wrong fitment for my vehicle" },
  { value: "damaged_in_shipping", label: "Damaged in shipping" },
  { value: "other", label: "Other" },
] as const;

function NewReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = searchParams.get("orderId");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [reason, setReason] = useState<string>("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const redirect = orderId ? `/returns/new?orderId=${orderId}` : "/returns/new";
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
  }, [authLoading, isAuthenticated, router, orderId]);

  const { data: order, isLoading } = useQuery({
    queryKey: ["my-order", orderId],
    queryFn: () =>
      api<{
        id: string;
        orderNumber: string;
        status: string;
        items: Array<{ id: string; productName: string; productNumber: string; quantity: number; unitPrice: string; lineTotal: string }>;
      }>(`/api/store/orders/${orderId}`),
    enabled: isAuthenticated && !!orderId,
  });

  const createMutation = useMutation({
    mutationFn: (body: { orderId: string; reason: string; reasonDetails?: string; items: { orderItemId: string; quantity: number }[] }) =>
      api("/api/store/returns", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-returns"] });
      router.push("/returns");
    },
  });

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[itemId];
      else next[itemId] = quantity;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !reason || Object.keys(selectedItems).length === 0) return;
    const items = Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity, reason }));
    createMutation.mutate({ orderId, reason, reasonDetails: reasonDetails || undefined, items });
  };

  if (authLoading || !isAuthenticated) return null;

  if (!orderId) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Returns", href: "/returns" }, { label: "New Return" }]} />
        <div className="text-center py-16 space-y-3">
          <RotateCcw className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">Select an order to request a return.</p>
          <Link href="/orders" className="text-primary hover:underline text-sm">View your orders</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 text-center space-y-3">
        <p className="text-muted-foreground">Order not found.</p>
        <Link href="/returns" className="text-primary hover:underline text-sm">Back to returns</Link>
      </div>
    );
  }

  if (order.status !== "delivered") {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Orders", href: "/orders" }, { label: order.orderNumber, href: `/orders/${orderId}` }, { label: "Return" }]} />
        <div className="flex items-center gap-3 p-4 border border-amber-200 rounded-lg bg-amber-50">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Returns are only available for delivered orders. This order is currently: <strong>{order.status.replace(/_/g, " ")}</strong>.
          </p>
        </div>
        <Link href={`/orders/${orderId}`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to order
        </Link>
      </div>
    );
  }

  const selectedCount = Object.values(selectedItems).filter(q => q > 0).length;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Orders", href: "/orders" }, { label: order.orderNumber, href: `/orders/${orderId}` }, { label: "Return Request" }]} />

      <Link href={`/orders/${orderId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Order {order.orderNumber}
      </Link>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <RotateCcw className="h-6 w-6 text-primary" />
          Request a Return
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Select the items you&apos;d like to return and tell us why.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Items */}
        <section>
          <h2 className="font-semibold mb-3">Select items to return</h2>
          <div className="border rounded-xl overflow-hidden divide-y bg-card">
            {order.items.map((item) => {
              const qty = selectedItems[item.id] ?? 0;
              return (
                <div key={item.id} className={`p-4 flex items-center justify-between gap-4 transition-colors ${qty > 0 ? "bg-primary/5" : ""}`}>
                  <div className="min-w-0">
                    <p className="font-medium text-sm line-clamp-1">{item.productName}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.productNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatPrice(item.unitPrice)} x {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {qty > 0 && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Return qty</label>
                      <select
                        value={qty}
                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                        className="border rounded-lg px-2.5 py-1.5 text-sm w-16 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {Array.from({ length: item.quantity + 1 }, (_, i) => (
                          <option key={i} value={i}>{i}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Reason */}
        <section className="space-y-4">
          <div>
            <label className="block font-semibold mb-2">Reason for return</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a reason</option>
              {RETURN_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-2">
              Additional details <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm min-h-[80px] bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Describe the issue..."
            />
          </div>
        </section>

        {createMutation.isError && (
          <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {(createMutation.error as Error).message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!reason || selectedCount === 0 || createMutation.isPending}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            {createMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
            ) : (
              <>Submit Return Request {selectedCount > 0 && `(${selectedCount} item${selectedCount !== 1 ? "s" : ""})`}</>
            )}
          </button>
          <Link
            href={`/orders/${orderId}`}
            className="px-6 py-2.5 border rounded-lg font-medium text-sm hover:bg-accent transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewReturnPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <NewReturnContent />
    </Suspense>
  );
}
