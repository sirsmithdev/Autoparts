"use client";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useCart";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { StockBadge } from "@/components/StockBadge";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Trash2, ShoppingCart, Minus, Plus, ShieldCheck, Truck, Package } from "lucide-react";

export default function CartPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shopping Cart" }]} />
      {isAuthenticated ? <ServerCart /> : <GuestCart />}
    </div>
  );
}

function CartItemRow({
  name,
  partNumber,
  imageUrl,
  price,
  quantity,
  partId,
  stockBadge,
  priceChanged,
  onUpdate,
  onRemove,
}: {
  name: string;
  partNumber: string;
  imageUrl?: string | null;
  price: string;
  quantity: number;
  partId: string;
  stockBadge?: React.ReactNode;
  priceChanged?: boolean;
  onUpdate: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-4 p-4 border rounded-lg bg-card">
      <Link href={`/parts/${partId}`} className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-md overflow-hidden flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-contain p-1" />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground/30" />
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/parts/${partId}`} className="font-medium hover:text-primary line-clamp-2">{name}</Link>
        <p className="text-sm text-muted-foreground font-mono mt-0.5">{partNumber}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {stockBadge}
          {priceChanged && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Price updated</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end justify-between shrink-0">
        <p className="text-lg font-bold">{formatPrice(parseFloat(price) * quantity)}</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <button
              className="p-1.5 hover:bg-accent transition-colors disabled:opacity-30"
              onClick={() => onUpdate(quantity - 1)}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="px-3 py-1 text-sm font-medium tabular-nums border-x min-w-[2.5rem] text-center">{quantity}</span>
            <button className="p-1.5 hover:bg-accent transition-colors" onClick={() => onUpdate(quantity + 1)} aria-label="Increase quantity">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={onRemove}
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
            title="Remove item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{formatPrice(price)} each</p>
      </div>
    </div>
  );
}

function CartSummary({
  subtotal,
  itemCount,
  disabled,
  href,
  label,
}: {
  subtotal: number;
  itemCount: number;
  disabled: boolean;
  href: string;
  label: string;
}) {
  return (
    <div className="border rounded-lg bg-card p-6 h-fit space-y-5 sticky top-24">
      <h2 className="text-lg font-bold">Order Summary</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal ({itemCount} item{itemCount !== 1 ? "s" : ""})</span>
          <span className="font-medium">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Delivery</span>
          <span className="text-muted-foreground">Calculated at checkout</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax</span>
          <span className="text-muted-foreground">Calculated at checkout</span>
        </div>
      </div>
      <div className="border-t pt-4 flex justify-between items-center">
        <span className="font-bold text-lg">Estimated Total</span>
        <span className="font-bold text-xl">{formatPrice(subtotal)}</span>
      </div>
      <Link
        href={disabled ? "#" : href}
        onClick={(e) => disabled && e.preventDefault()}
        className={`block w-full py-3 text-center rounded-lg font-semibold text-sm transition-colors ${
          disabled
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {label}
      </Link>
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>Secure checkout with encrypted payment</span>
      </div>
    </div>
  );
}

function GuestCart() {
  const { guestItems, removeGuestItem, updateGuestQuantity } = useGuestCart();
  const subtotal = guestItems.reduce((s, i) => s + parseFloat(i.salePrice) * i.quantity, 0);

  if (guestItems.length === 0) return <EmptyCart />;

  return (
    <div className="mt-6">
      <h1 className="text-2xl font-bold mb-6">Shopping Cart</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {guestItems.map(item => (
            <CartItemRow
              key={item.partId}
              name={item.name}
              partNumber={item.partNumber}
              imageUrl={item.imageUrl}
              price={item.salePrice}
              quantity={item.quantity}
              partId={item.partId}
              onUpdate={(qty) => updateGuestQuantity(item.partId, qty)}
              onRemove={() => removeGuestItem(item.partId)}
            />
          ))}
        </div>
        <CartSummary
          subtotal={subtotal}
          itemCount={guestItems.length}
          disabled={false}
          href="/login"
          label="Login to Checkout"
        />
      </div>
    </div>
  );
}

function ServerCart() {
  const queryClient = useQueryClient();
  const { data: cartData, isLoading } = useQuery<{ items: Array<{ id: string; partId: string; quantity: number; currentPrice: string; priceChanged: boolean; stockStatus: string; part: { name: string; partNumber: string; imageUrl?: string | null } }>; itemCount: number }>({
    queryKey: ["server-cart"],
    queryFn: () => api("/api/store/cart"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api(`/api/store/cart/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["server-cart"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => api(`/api/store/cart/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["server-cart"] }),
  });

  if (isLoading) return <CartSkeleton />;

  const items = cartData?.items || [];
  if (items.length === 0) return <EmptyCart />;

  const subtotal = items.reduce((s, i) => s + parseFloat(i.currentPrice) * i.quantity, 0);
  const hasStockIssues = items.some(i => i.stockStatus === "out_of_stock" || i.stockStatus === "insufficient_stock");

  return (
    <div className="mt-6">
      <h1 className="text-2xl font-bold mb-6">Shopping Cart</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {items.map(item => (
            <CartItemRow
              key={item.id}
              name={item.part.name}
              partNumber={item.part.partNumber}
              imageUrl={item.part.imageUrl}
              price={item.currentPrice}
              quantity={item.quantity}
              partId={item.partId}
              stockBadge={<StockBadge status={item.stockStatus} />}
              priceChanged={item.priceChanged}
              onUpdate={(qty) => updateMutation.mutate({ itemId: item.id, quantity: qty })}
              onRemove={() => removeMutation.mutate(item.id)}
            />
          ))}
        </div>
        <CartSummary
          subtotal={subtotal}
          itemCount={items.length}
          disabled={hasStockIssues}
          href="/checkout"
          label={hasStockIssues ? "Remove unavailable items" : "Proceed to Checkout"}
        />
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="mt-6 grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4 p-4 border rounded-lg">
            <Skeleton className="w-24 h-24 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="text-center py-20 space-y-4">
      <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
        <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
      </div>
      <h1 className="text-2xl font-bold">Your cart is empty</h1>
      <p className="text-muted-foreground max-w-sm mx-auto">Browse our catalog to find the parts you need for your vehicle.</p>
      <Link href="/search" className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
        <Truck className="h-4 w-4" />
        Browse Parts
      </Link>
    </div>
  );
}
