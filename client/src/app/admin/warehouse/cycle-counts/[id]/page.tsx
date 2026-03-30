"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle, Loader2, ClipboardCheck, SkipForward,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface CycleCountItem {
  id: string;
  productId: string;
  binId: string;
  expectedQuantity: number;
  actualQuantity: number | null;
  variance: number | null;
  status: string;
  countedAt: string | null;
  productName: string;
  partNumber: string;
  binCode: string;
}

interface CycleCountDetail {
  id: string;
  locationId: string;
  locationName: string | null;
  status: string;
  startedBy: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string | null;
  items: CycleCountItem[];
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  counted: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  skipped: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" },
};

const ccStatusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  in_progress: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  completed: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
};

export default function CycleCountDetailPage() {
  const params = useParams();
  const cycleCountId = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [countValues, setCountValues] = useState<Record<string, string>>({});

  const { data: cycleCount, isLoading } = useQuery<CycleCountDetail>({
    queryKey: ["warehouse-cycle-count", cycleCountId],
    queryFn: () => api<CycleCountDetail>(`/api/store/admin/warehouse/cycle-counts/${cycleCountId}`),
    enabled: !!cycleCountId,
  });

  const countMutation = useMutation({
    mutationFn: ({ itemId, actualQuantity }: { itemId: string; actualQuantity: number }) =>
      api(`/api/store/admin/warehouse/cycle-counts/${cycleCountId}/items/${itemId}/count`, {
        method: "POST",
        body: JSON.stringify({ actualQuantity }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-cycle-count", cycleCountId] });
      toast({ title: "Count recorded" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const skipMutation = useMutation({
    mutationFn: (itemId: string) =>
      api(`/api/store/admin/warehouse/cycle-counts/${cycleCountId}/items/${itemId}/skip`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-cycle-count", cycleCountId] });
      toast({ title: "Item skipped" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      api(`/api/store/admin/warehouse/cycle-counts/${cycleCountId}/complete`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-cycle-count", cycleCountId] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-cycle-counts"] });
      toast({ title: "Cycle count completed and adjustments applied" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cycleCount) {
    return (
      <div className="text-center py-20 space-y-3">
        <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="text-muted-foreground">Cycle count not found</p>
        <Link href="/admin/warehouse/cycle-counts" className="text-primary hover:underline text-sm">Back to Cycle Counts</Link>
      </div>
    );
  }

  const ccCfg = ccStatusConfig[cycleCount.status] || ccStatusConfig.pending;
  const allResolved = cycleCount.items.every((item) => item.status === "counted" || item.status === "skipped");
  const canComplete = cycleCount.status !== "completed" && allResolved && cycleCount.items.length > 0;

  return (
    <div className="space-y-6">
      <Link href="/admin/warehouse/cycle-counts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Cycle Counts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cycle Count</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {cycleCount.locationName || "Unknown Location"}
            {cycleCount.createdAt && <> &middot; {format(new Date(cycleCount.createdAt), "MMM d, yyyy 'at' h:mm a")}</>}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${ccCfg.bg} ${ccCfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ccCfg.dot}`} />
          {cycleCount.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Complete Button */}
      {canComplete && (
        <button
          onClick={() => { if (!window.confirm("Complete this cycle count and apply all adjustments?")) return; completeMutation.mutate(); }}
          disabled={completeMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Complete & Apply Adjustments
        </button>
      )}

      {/* Items Table */}
      <div className="border rounded-md bg-card overflow-hidden">
        <div className="px-5 py-3 bg-muted/40 border-b">
          <h2 className="font-semibold text-sm">Items ({cycleCount.items.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Bin</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Expected</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Actual</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Variance</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                {cycleCount.status !== "completed" && (
                  <th className="w-40 p-3"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {cycleCount.items.length === 0 ? (
                <tr>
                  <td colSpan={cycleCount.status !== "completed" ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    No items in this cycle count
                  </td>
                </tr>
              ) : cycleCount.items.map((item) => {
                const icfg = statusConfig[item.status] || statusConfig.pending;
                const displayVariance = item.variance ?? (
                  countValues[item.id] !== undefined
                    ? parseInt(countValues[item.id] || "0") - item.expectedQuantity
                    : null
                );
                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.partNumber}</p>
                    </td>
                    <td className="p-3 font-mono text-xs">{item.binCode}</td>
                    <td className="p-3 text-right font-medium">{item.expectedQuantity}</td>
                    <td className="p-3 text-center">
                      {item.status === "pending" && cycleCount.status !== "completed" ? (
                        <input
                          type="number"
                          min={0}
                          placeholder="Count"
                          className="w-20 border rounded px-2 py-1.5 text-sm text-center bg-background focus:outline-none focus:ring-2 focus:ring-ring mx-auto"
                          value={countValues[item.id] ?? ""}
                          onChange={(e) => setCountValues((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        />
                      ) : (
                        <span className="font-medium">{item.actualQuantity ?? "\u2014"}</span>
                      )}
                    </td>
                    <td className={`p-3 text-right font-semibold ${
                      displayVariance === null ? "" :
                      displayVariance > 0 ? "text-green-600" :
                      displayVariance < 0 ? "text-red-600" : ""
                    }`}>
                      {displayVariance === null ? "\u2014" : displayVariance > 0 ? `+${displayVariance}` : displayVariance}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${icfg.bg} ${icfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${icfg.dot}`} />
                        {item.status}
                      </span>
                    </td>
                    {cycleCount.status !== "completed" && (
                      <td className="p-3">
                        {item.status === "pending" && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                const val = parseInt(countValues[item.id] || "0");
                                if (countValues[item.id] === undefined || countValues[item.id] === "") {
                                  toast({ title: "Enter a count value first", variant: "destructive" });
                                  return;
                                }
                                countMutation.mutate({ itemId: item.id, actualQuantity: val });
                              }}
                              disabled={countMutation.isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Record
                            </button>
                            <button
                              onClick={() => skipMutation.mutate(item.id)}
                              disabled={skipMutation.isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                            >
                              <SkipForward className="h-3.5 w-3.5" /> Skip
                            </button>
                          </div>
                        )}
                      </td>
                    )}
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
