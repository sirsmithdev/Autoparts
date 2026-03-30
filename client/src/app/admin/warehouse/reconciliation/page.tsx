"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface Discrepancy {
  productId: string;
  productName: string;
  partNumber: string;
  systemQuantity: number;
  binTotalQuantity: number;
  discrepancy: number;
}

export default function ReconciliationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reconciledIds, setReconciledIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{ discrepancies: Discrepancy[]; total: number }>({
    queryKey: ["warehouse-reconciliation"],
    queryFn: () => api<{ discrepancies: Discrepancy[]; total: number }>("/api/store/admin/warehouse/reconciliation"),
  });

  const discrepancies = data?.discrepancies ?? [];

  const reconcileMutation = useMutation({
    mutationFn: (productId: string) =>
      api(`/api/store/admin/warehouse/reconciliation/${productId}`, { method: "POST" }),
    onSuccess: (_data, productId) => {
      setReconciledIds((prev) => new Set([...prev, productId]));
      toast({ title: "Product reconciled" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reconcileAllMutation = useMutation({
    mutationFn: async () => {
      const remaining = discrepancies.filter((d) => !reconciledIds.has(d.productId));
      let count = 0;
      for (const d of remaining) {
        await api(`/api/store/admin/warehouse/reconciliation/${d.productId}`, { method: "POST" });
        count++;
        setReconciledIds((prev) => new Set([...prev, d.productId]));
      }
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-reconciliation"] });
      toast({ title: `Reconciled ${count} product(s)` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const unreconciledCount = discrepancies.filter((d) => !reconciledIds.has(d.productId)).length;

  return (
    <div className="space-y-6">
      <Link href="/admin/warehouse" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Warehouse
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Reconciliation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Resolve discrepancies between system quantities and bin totals</p>
        </div>
        {unreconciledCount > 0 && (
          <button
            onClick={() => reconcileAllMutation.mutate()}
            disabled={reconcileAllMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {reconcileAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reconcile All ({unreconciledCount})
          </button>
        )}
      </div>

      <div className="border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Part Number</th>
                <th className="text-right p-3 font-medium text-muted-foreground">System Qty</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Bin Total</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Difference</th>
                <th className="w-32 p-3 text-right font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : discrepancies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">No discrepancies found</p>
                  </td>
                </tr>
              ) : discrepancies.map((d) => {
                const isReconciled = reconciledIds.has(d.productId);
                return (
                  <tr key={d.productId} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${isReconciled ? "opacity-50" : ""}`}>
                    <td className="p-3 font-medium">{d.productName}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{d.partNumber}</td>
                    <td className="p-3 text-right">{d.systemQuantity}</td>
                    <td className="p-3 text-right">{d.binTotalQuantity}</td>
                    <td className={`p-3 text-right font-semibold ${d.discrepancy > 0 ? "text-green-600" : "text-red-600"}`}>
                      {d.discrepancy > 0 ? "+" : ""}{d.discrepancy}
                    </td>
                    <td className="p-3 text-right">
                      {isReconciled ? (
                        <span className="text-xs text-green-600 font-medium">Reconciled</span>
                      ) : (
                        <button
                          onClick={() => reconcileMutation.mutate(d.productId)}
                          disabled={reconcileMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          Reconcile
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
