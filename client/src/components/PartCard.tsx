"use client";
import Link from "next/link";
import { StockBadge } from "./StockBadge";
import { formatPrice } from "@/lib/utils";
import { ShoppingCart, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useCart";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface PartCardProps {
  id: string;
  name: string;
  partNumber: string;
  salePrice: string;
  category?: string | null;
  manufacturer?: string | null;
  imageUrl?: string | null;
  stockStatus: string;
  condition?: string;
  vehicleFits?: boolean;
}

export function PartCard({
  id, name, partNumber, salePrice, category, manufacturer,
  imageUrl, stockStatus, condition, vehicleFits,
}: PartCardProps) {
  const { isAuthenticated } = useAuth();
  const addGuestItem = useGuestCart((s) => s.addGuestItem);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (stockStatus === "out_of_stock") return;

    if (isAuthenticated) {
      api("/api/store/cart/items", { method: "POST", body: JSON.stringify({ partId: id, quantity: 1 }) })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["server-cart"] });
          toast({ title: "Added to cart", description: name });
        })
        .catch((err) => {
          toast({ title: "Failed to add to cart", description: err?.message || "Please try again", variant: "destructive" });
        });
    } else {
      addGuestItem({ partId: id, quantity: 1, name, partNumber, salePrice, imageUrl });
    }
  };

  return (
    <Link
      href={`/parts/${id}`}
      className="group flex flex-col border rounded-lg overflow-hidden bg-card hover:shadow-lg transition-all duration-200"
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="object-contain w-full h-full p-2 group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="text-5xl text-gray-200 select-none">&#9881;</div>
        )}
        {/* Fitment badge */}
        {vehicleFits && (
          <span className="absolute top-2 right-2 flex items-center gap-1 bg-green-600 text-white text-[10px] font-semibold px-2 py-1 rounded shadow-sm">
            <CheckCircle2 className="h-3 w-3" />
            Fits
          </span>
        )}
        {/* Condition badge */}
        {condition && condition !== "new" && (
          <span className="absolute top-2 left-2 bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-1 rounded capitalize">
            {condition}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 space-y-1.5">
        {/* Manufacturer */}
        {manufacturer && (
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">
            {manufacturer}
          </span>
        )}
        {/* Category */}
        {!manufacturer && category && (
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{category}</span>
        )}

        {/* Product name */}
        <h3 className="font-medium text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {name}
        </h3>

        {/* Part number */}
        <p className="text-xs text-muted-foreground font-mono">{partNumber}</p>

        {/* Price + Stock */}
        <div className="flex items-center justify-between pt-2 mt-auto">
          <span className="font-bold text-lg tracking-tight">{formatPrice(salePrice)}</span>
          <StockBadge status={stockStatus} />
        </div>

        {/* Add to cart */}
        {stockStatus !== "out_of_stock" && (
          <button
            onClick={handleAddToCart}
            className="w-full mt-2 py-2 px-3 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 active:scale-[0.98] flex items-center justify-center gap-2 transition-all"
          >
            <ShoppingCart className="h-4 w-4" />
            Add to Cart
          </button>
        )}
      </div>
    </Link>
  );
}
