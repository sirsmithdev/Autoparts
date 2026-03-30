"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Search, Loader2, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface ProductLookup {
  id: string;
  name: string;
  partNumber: string;
}

interface ProductBin {
  bin: { id: string; binCode: string; locationId: string; locationName: string; description: string | null; isActive: boolean };
  quantity: number;
}

export default function StockAdjustPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductLookup | null>(null);
  const [binId, setBinId] = useState("");
  const [adjustType, setAdjustType] = useState<"increase" | "decrease">("increase");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: searchResults = [] } = useQuery<ProductLookup[]>({
    queryKey: ["product-lookup", query],
    queryFn: () => api<ProductLookup[]>(`/api/store/pos/lookup?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });

  const { data: productBins = [] } = useQuery<ProductBin[]>({
    queryKey: ["warehouse-product-bins", selectedProduct?.id],
    queryFn: () => api<ProductBin[]>(`/api/store/admin/warehouse/product/${selectedProduct!.id}/bins`),
    enabled: !!selectedProduct,
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const adjustMutation = useMutation({
    mutationFn: () =>
      api("/api/store/admin/warehouse/adjust", {
        method: "POST",
        body: JSON.stringify({
          productId: selectedProduct!.id,
          binId,
          quantity: adjustType === "increase" ? quantity : -quantity,
          reason,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Stock adjusted successfully" });
      setSelectedProduct(null);
      setBinId("");
      setQuantity(1);
      setReason("");
      setQuery("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Link href="/admin/warehouse" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Warehouse
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Adjust Stock</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manually adjust inventory quantities</p>
      </div>

      <div className="border rounded-md bg-card p-5 space-y-4 max-w-lg">
        <div ref={wrapperRef} className="relative">
          <label className="text-sm font-medium text-muted-foreground">Product</label>
          {selectedProduct ? (
            <div className="mt-1 flex items-center justify-between border rounded-lg px-3 py-2.5 bg-muted/30">
              <div>
                <span className="font-medium text-sm">{selectedProduct.name}</span>
                <span className="text-muted-foreground ml-2 font-mono text-xs">{selectedProduct.partNumber}</span>
              </div>
              <button onClick={() => { setSelectedProduct(null); setBinId(""); setQuery(""); }} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
            </div>
          ) : (
            <>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Search products..."
                  className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => { if (query.length >= 2) setSearchOpen(true); }}
                />
              </div>
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg max-h-48 overflow-auto">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                      onClick={() => { setSelectedProduct(p); setSearchOpen(false); setQuery(""); setBinId(""); }}
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground font-mono text-xs">{p.partNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Bin</label>
          {!selectedProduct ? (
            <p className="text-sm text-muted-foreground mt-1">Select a product first</p>
          ) : productBins.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">No bin assignments for this product</p>
          ) : (
            <select
              className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={binId}
              onChange={(e) => setBinId(e.target.value)}
            >
              <option value="">Select bin</option>
              {productBins.map((pb) => (
                <option key={pb.bin.id} value={pb.bin.id}>
                  {pb.bin.binCode} - Qty: {pb.quantity}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Adjustment Type</label>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setAdjustType("increase")}
              className={`flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                adjustType === "increase" ? "bg-green-50 border-green-300 text-green-700" : "hover:bg-accent"
              }`}
            >
              Increase
            </button>
            <button
              onClick={() => setAdjustType("decrease")}
              className={`flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                adjustType === "decrease" ? "bg-red-50 border-red-300 text-red-700" : "hover:bg-accent"
              }`}
            >
              Decrease
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Quantity</label>
          <input
            type="number"
            min={1}
            className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Reason (required)</label>
          <input
            placeholder="Explain the adjustment..."
            className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => adjustMutation.mutate()}
            disabled={!selectedProduct || !binId || !reason.trim() || quantity < 1 || adjustMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {adjustMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlidersHorizontal className="h-4 w-4" />}
            Adjust
          </button>
        </div>
      </div>
    </div>
  );
}
