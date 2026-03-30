"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { StockBadge } from "@/components/StockBadge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart, ShoppingCart, Trash2, Package, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WishlistItem {
  wishlistId: string;
  productId: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    partNumber: string;
    salePrice: string;
    imageUrl?: string | null;
    quantity: number;
    lowStockThreshold: number;
    isActive: boolean;
  };
  images: Array<{ id: string; imageUrl: string; altText?: string | null; isPrimary: boolean }>;
}

function getStockStatus(product: { quantity: number; lowStockThreshold: number }): string {
  if (product.quantity <= 0) return "out_of_stock";
  if (product.quantity <= product.lowStockThreshold) return "low_stock";
  return "in_stock";
}

export default function WishlistPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login?redirect=/wishlist");
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Skeleton className="h-4 w-48 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]} />
      <WishlistContent />
    </div>
  );
}

function WishlistContent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const addGuestItem = useGuestCart((s) => s.addGuestItem);

  const { data: items = [], isLoading } = useQuery<WishlistItem[]>({
    queryKey: ["wishlist"],
    queryFn: () => api("/api/store/wishlist"),
    enabled: isAuthenticated,
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) =>
      api(`/api/store/wishlist/${productId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      toast({ title: "Removed from wishlist" });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const addToCartMutation = useMutation({
    mutationFn: async (item: WishlistItem) => {
      if (isAuthenticated) {
        await api("/api/store/cart/items", {
          method: "POST",
          body: JSON.stringify({ productId: item.productId, quantity: 1 }),
        });
        queryClient.invalidateQueries({ queryKey: ["server-cart"] });
      } else {
        addGuestItem({
          partId: item.productId,
          quantity: 1,
          name: item.product.name,
          partNumber: item.product.partNumber,
          salePrice: item.product.salePrice,
          imageUrl: item.product.imageUrl,
        });
      }
    },
    onSuccess: () => toast({ title: "Added to cart" }),
    onError: (err) => toast({
      title: err instanceof Error ? err.message : "Failed to add to cart",
      variant: "destructive",
    }),
  });

  if (isLoading) {
    return (
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-72 rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-24 space-y-5">
        <Heart className="h-20 w-20 text-muted-foreground/25 mx-auto" />
        <h1 className="text-2xl font-bold">Your wishlist is empty</h1>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Save items you love to your wishlist and come back to them later.
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          Browse Parts
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Wishlist</h1>
        <span className="text-sm text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map(item => {
          const primaryImage = item.images.find(i => i.isPrimary) || item.images[0];
          const imageUrl = primaryImage?.imageUrl || item.product.imageUrl;
          const stockStatus = getStockStatus(item.product);
          const outOfStock = stockStatus === "out_of_stock";

          return (
            <div key={item.wishlistId} className="border rounded-lg bg-card overflow-hidden group">
              <Link href={`/parts/${item.productId}`} className="block aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
                {imageUrl ? (
                  <img src={imageUrl} alt={item.product.name} className="object-contain w-full h-full p-4" />
                ) : (
                  <Package className="h-12 w-12 text-muted-foreground/20" />
                )}
              </Link>
              <div className="p-4 space-y-2">
                <Link href={`/parts/${item.productId}`} className="text-sm font-medium hover:text-primary line-clamp-2 block">
                  {item.product.name}
                </Link>
                <p className="text-xs text-muted-foreground font-mono">{item.product.partNumber}</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{formatPrice(item.product.salePrice)}</span>
                  <StockBadge status={stockStatus} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => !outOfStock && addToCartMutation.mutate(item)}
                    disabled={outOfStock || addToCartMutation.isPending}
                    className="flex-1 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {outOfStock ? "Out of Stock" : "Add to Cart"}
                  </button>
                  <button
                    onClick={() => removeMutation.mutate(item.productId)}
                    disabled={removeMutation.isPending}
                    className="p-2 border rounded-md text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                    title="Remove from wishlist"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
