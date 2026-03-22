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
import { useState } from "react";
import { Trash2, ShoppingCart, Minus, Plus, Package, Truck } from "lucide-react";

const FREE_SHIPPING_THRESHOLD = 15000;

export default function CartPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      {isAuthenticated ? <ServerCart /> : <GuestCart />}
    </div>
  );
}

function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
  const progress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);

  if (remaining <= 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center gap-2 text-sm text-green-700">
        <Truck className="h-4 w-4 shrink-0" />
        <span className="font-medium">You qualify for free shipping!</span>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm text-green-700">
        <Truck className="h-4 w-4 shrink-0" />
        <span>Add <span className="font-bold">{formatPrice(remaining)}</span> to cart and get <span className="font-bold">free shipping</span></span>
      </div>
      <div className="w-full bg-green-200 rounded-full h-1.5">
        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function CartTable({
  items,
  onUpdate,
  onRemove,
}: {
  items: Array<{ id: string; partId: string; name: string; partNumber: string; imageUrl?: string | null; price: string; quantity: number; stockBadge?: React.ReactNode; priceChanged?: boolean }>;
  onUpdate: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  const [coupon, setCoupon] = useState("");

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground" colSpan={2}>Product</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Price</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Quantity</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Subtotal</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-3 w-20">
                    <Link href={`/parts/${item.partId}`} className="block w-16 h-16 bg-muted rounded overflow-hidden flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-1" />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground/30" />
                      )}
                    </Link>
                  </td>
                  <td className="p-3">
                    <Link href={`/parts/${item.partId}`} className="font-medium hover:text-primary line-clamp-2 text-sm">{item.name}</Link>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.partNumber}</p>
                    {item.stockBadge && <div className="mt-1">{item.stockBadge}</div>}
                    {item.priceChanged && (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1 inline-block">Price updated</span>
                    )}
                  </td>
                  <td className="p-3 font-medium">{formatPrice(item.price)}</td>
                  <td className="p-3">
                    <div className="flex items-center border rounded-md w-fit">
                      <button
                        className="p-1.5 hover:bg-accent transition-colors disabled:opacity-30"
                        onClick={() => onUpdate(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-3 py-1 text-sm font-medium tabular-nums border-x min-w-[2rem] text-center">{item.quantity}</span>
                      <button className="p-1.5 hover:bg-accent transition-colors" onClick={() => onUpdate(item.id, item.quantity + 1)} aria-label="Increase quantity">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-right font-bold">{formatPrice(parseFloat(item.price) * item.quantity)}</td>
                  <td className="p-3">
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coupon + actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex gap-2 flex-1">
          <input
            type="text"
            placeholder="Coupon code"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring w-48"
          />
          <button className="px-4 py-2 bg-foreground text-white rounded-md text-sm font-medium hover:bg-foreground/90 transition-colors">
            Apply Coupon
          </button>
        </div>
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
    <div className="border rounded-md bg-card p-6 h-fit space-y-4 sticky top-24">
      <h2 className="text-lg font-bold">Cart totals</h2>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between pb-3 border-b">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between pb-3 border-b">
          <span className="text-muted-foreground">Shipping</span>
          <div className="text-right">
            {subtotal >= FREE_SHIPPING_THRESHOLD ? (
              <span className="font-medium text-green-600">Free</span>
            ) : (
              <>
                <span className="text-muted-foreground text-xs">Flat rate: {formatPrice(1500)}</span>
                <br />
                <span className="text-muted-foreground text-xs">Shipping to JA.</span>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-between pt-1">
          <span className="font-bold text-base">Total</span>
          <span className="font-bold text-base">{formatPrice(subtotal >= FREE_SHIPPING_THRESHOLD ? subtotal : subtotal + 1500)}</span>
        </div>
      </div>
      <Link
        href={disabled ? "#" : href}
        onClick={(e) => disabled && e.preventDefault()}
        className={`block w-full py-3 text-center rounded-md font-semibold text-sm transition-colors ${
          disabled
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {label}
      </Link>
    </div>
  );
}

function GuestCart() {
  const { guestItems, removeGuestItem, updateGuestQuantity } = useGuestCart();
  const subtotal = guestItems.reduce((s, i) => s + parseFloat(i.salePrice) * i.quantity, 0);

  if (guestItems.length === 0) return <EmptyCart />;

  const tableItems = guestItems.map(item => ({
    id: item.partId,
    partId: item.partId,
    name: item.name,
    partNumber: item.partNumber,
    imageUrl: item.imageUrl,
    price: item.salePrice,
    quantity: item.quantity,
  }));

  return (
    <div className="mt-6">
      <FreeShippingBar subtotal={subtotal} />
      <div className="grid lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2">
          <CartTable
            items={tableItems}
            onUpdate={(id, qty) => updateGuestQuantity(id, qty)}
            onRemove={(id) => removeGuestItem(id)}
          />
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

  const tableItems = items.map(item => ({
    id: item.id,
    partId: item.partId,
    name: item.part.name,
    partNumber: item.part.partNumber,
    imageUrl: item.part.imageUrl,
    price: item.currentPrice,
    quantity: item.quantity,
    stockBadge: <StockBadge status={item.stockStatus} />,
    priceChanged: item.priceChanged,
  }));

  return (
    <div className="mt-6">
      <FreeShippingBar subtotal={subtotal} />
      <div className="grid lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2">
          <CartTable
            items={tableItems}
            onUpdate={(id, qty) => updateMutation.mutate({ itemId: id, quantity: qty })}
            onRemove={(id) => removeMutation.mutate(id)}
          />
        </div>
        <CartSummary
          subtotal={subtotal}
          itemCount={items.length}
          disabled={hasStockIssues}
          href="/checkout"
          label={hasStockIssues ? "Remove unavailable items" : "Proceed to checkout"}
        />
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="mt-6 grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <div className="border rounded-md overflow-hidden">
          <div className="p-3 bg-muted/40 border-b"><Skeleton className="h-4 w-48" /></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 p-3 border-b last:border-0">
              <Skeleton className="w-16 h-16 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-64 rounded-md" />
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="text-center py-24 space-y-5">
      <ShoppingCart className="h-20 w-20 text-muted-foreground/25 mx-auto" />
      <h1 className="text-2xl font-bold">Your cart is currently empty.</h1>
      <p className="text-muted-foreground max-w-sm mx-auto">
        Browse our catalog to find the parts you need for your vehicle.
      </p>
      <Link
        href="/search"
        className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors"
      >
        Return to shop
      </Link>
    </div>
  );
}
