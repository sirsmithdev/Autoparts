"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface WarehouseBin {
  id: string;
  binCode: string;
  locationName: string;
}

interface BinContent {
  product: {
    id: string;
    name: string;
    partNumber: string;
  };
  quantity: number;
}

export default function StockTransferPage() {
  const { toast } = useToast();
  const [fromBinId, setFromBinId] = useState("");
  const [toBinId, setToBinId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const { data: bins = [] } = useQuery<WarehouseBin[]>({
    queryKey: ["warehouse-bins", "all"],
    queryFn: () => api<WarehouseBin[]>("/api/store/admin/warehouse/bins"),
  });

  const { data: sourceContents = [], isLoading: contentsLoading } = useQuery<BinContent[]>({
    queryKey: ["warehouse-bin-contents", fromBinId],
    queryFn: () => api<BinContent[]>(`/api/store/admin/warehouse/bins/${fromBinId}/contents`),
    enabled: !!fromBinId,
  });

  const selectedProduct = sourceContents.find((c) => c.product.id === productId);
  const maxQty = selectedProduct?.quantity ?? 0;

  const transferMutation = useMutation({
    mutationFn: () =>
      api("/api/store/admin/warehouse/transfer", {
        method: "POST",
        body: JSON.stringify({ productId, fromBinId, toBinId, quantity }),
      }),
    onSuccess: () => {
      toast({ title: "Stock transferred successfully" });
      setFromBinId("");
      setToBinId("");
      setProductId("");
      setQuantity(1);
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
        <h1 className="text-2xl font-bold">Transfer Stock</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Move stock between warehouse bins</p>
      </div>

      <div className="border rounded-md bg-card p-5 space-y-4 max-w-lg">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Source Bin</label>
          <select
            className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={fromBinId}
            onChange={(e) => { setFromBinId(e.target.value); setProductId(""); setQuantity(1); }}
          >
            <option value="">Select source bin</option>
            {bins.filter((b) => b.id !== toBinId).map((bin) => (
              <option key={bin.id} value={bin.id}>{bin.binCode} ({bin.locationName})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Product</label>
          {!fromBinId ? (
            <p className="text-sm text-muted-foreground mt-1">Select a source bin first</p>
          ) : contentsLoading ? (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</p>
          ) : sourceContents.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">Source bin is empty</p>
          ) : (
            <select
              className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={productId}
              onChange={(e) => { setProductId(e.target.value); setQuantity(1); }}
            >
              <option value="">Select product</option>
              {sourceContents.map((c) => (
                <option key={c.product.id} value={c.product.id}>
                  {c.product.name} ({c.product.partNumber}) - Qty: {c.quantity}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Destination Bin</label>
          <select
            className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={toBinId}
            onChange={(e) => setToBinId(e.target.value)}
          >
            <option value="">Select destination bin</option>
            {bins.filter((b) => b.id !== fromBinId).map((bin) => (
              <option key={bin.id} value={bin.id}>{bin.binCode} ({bin.locationName})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Quantity (max: {maxQty})</label>
          <input
            type="number"
            min={1}
            max={maxQty}
            className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={quantity}
            onChange={(e) => setQuantity(Math.min(parseInt(e.target.value) || 1, maxQty))}
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => transferMutation.mutate()}
            disabled={!fromBinId || !toBinId || !productId || quantity < 1 || quantity > maxQty || transferMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {transferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
