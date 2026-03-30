"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface LowStockItem {
  productId: string;
  productName: string;
  partNumber: string;
  currentStock: number;
  reorderPoint: number;
  lowStockThreshold: number;
  deficit: number;
}

export default function LowStockPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data, isLoading } = useQuery<{ items: LowStockItem[]; total: number }>({
    queryKey: ["warehouse-low-stock"],
    queryFn: () => api<{ items: LowStockItem[]; total: number }>("/api/store/admin/warehouse/low-stock"),
  });

  const items = data?.items ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ productId, reorderPoint }: { productId: string; reorderPoint: number }) =>
      api(`/api/store/admin/warehouse/reorder-point/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ reorderPoint }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-low-stock"] });
      toast({ title: "Reorder point updated" });
      setEditingId(null);
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
        <h1 className="text-2xl font-bold">Low Stock Alerts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Products at or below their reorder point</p>
      </div>

      <div className="border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Part Number</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Current Stock</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Reorder Point</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Deficit</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <AlertCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">No low stock items</p>
                  </td>
                </tr>
              ) : items.map((item) => (
                <tr
                  key={item.productId}
                  className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                    item.currentStock === 0 ? "bg-red-50/50" : ""
                  }`}
                >
                  <td className={`p-3 font-medium ${item.currentStock === 0 ? "text-red-700" : ""}`}>{item.productName}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{item.partNumber}</td>
                  <td className={`p-3 text-right font-semibold ${item.currentStock === 0 ? "text-red-600" : ""}`}>{item.currentStock}</td>
                  <td className="p-3 text-right">
                    {editingId === item.productId ? (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          className="w-20 border rounded px-2 py-1 text-sm text-right bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateMutation.mutate({ productId: item.productId, reorderPoint: parseInt(editValue) || 0 });
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                        />
                        <button
                          onClick={() => updateMutation.mutate({ productId: item.productId, reorderPoint: parseInt(editValue) || 0 })}
                          className="p-1 hover:bg-accent rounded transition-colors"
                        >
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 hover:bg-accent rounded transition-colors">
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(item.productId); setEditValue(String(item.reorderPoint)); }}
                        className="hover:underline cursor-pointer"
                        title="Click to edit"
                      >
                        {item.reorderPoint}
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold text-red-600">{item.deficit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
