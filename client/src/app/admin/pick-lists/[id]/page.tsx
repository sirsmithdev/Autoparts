"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle, Package, UserPlus, Play, X,
  ClipboardList, Loader2, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface PickListItem {
  id: string;
  productName: string;
  partNumber: string;
  binCode: string | null;
  quantityRequired: number;
  quantityPicked: number;
  status: string;
}

interface PickListDetail {
  id: string;
  pickListNumber: string;
  status: string;
  sourceOrderNumber: string | null;
  sourceOrderId: string | null;
  assignedTo: string | null;
  createdAt: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  items: PickListItem[];
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  assigned: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  in_progress: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  completed: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  cancelled: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" },
};

const itemStatusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  picked: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  short: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  skipped: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" },
};

export default function AdminPickListDetailPage() {
  const params = useParams();
  const pickListId = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [assignDialog, setAssignDialog] = useState(false);
  const [pickDialog, setPickDialog] = useState<PickListItem | null>(null);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [assignTo, setAssignTo] = useState("");
  const [pickQuantity, setPickQuantity] = useState("");

  const closeAllDialogs = useCallback(() => {
    setAssignDialog(false);
    setPickDialog(null);
    setCancelDialog(false);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeAllDialogs(); };
    if (assignDialog || pickDialog || cancelDialog) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [assignDialog, pickDialog, cancelDialog, closeAllDialogs]);

  const { data: pickList, isLoading } = useQuery<PickListDetail>({
    queryKey: ["admin-pick-list", pickListId],
    queryFn: () => api<PickListDetail>(`/api/store/admin/pick-lists/${pickListId}`),
    enabled: !!pickListId,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, body }: { action: string; body?: Record<string, unknown> }) => {
      return api(`/api/store/admin/pick-lists/${pickListId}/${action}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pick-lists"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pick-list", pickListId] });
      toast({ title: "Pick list updated" });
      closeAllDialogs();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const pickItemMutation = useMutation({
    mutationFn: async ({ itemId, quantityPicked }: { itemId: string; quantityPicked: number }) => {
      return api(`/api/store/admin/pick-lists/${pickListId}/items/${itemId}/pick`, {
        method: "POST",
        body: JSON.stringify({ quantityPicked }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pick-list", pickListId] });
      toast({ title: "Item picked" });
      setPickDialog(null);
      setPickQuantity("");
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

  if (!pickList) {
    return (
      <div className="text-center py-20 space-y-3">
        <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="text-muted-foreground">Pick list not found</p>
        <Link href="/admin/pick-lists" className="text-primary hover:underline text-sm">Back to Pick Lists</Link>
      </div>
    );
  }

  const cfg = statusConfig[pickList.status] || { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" };
  const allItemsResolved = pickList.items.every(
    (item) => item.status === "picked" || item.status === "short" || item.status === "skipped"
  );
  const canComplete = pickList.status === "in_progress" && allItemsResolved && pickList.items.length > 0;
  const canCancel = ["pending", "assigned", "in_progress"].includes(pickList.status);

  return (
    <div className="space-y-6">
      <Link href="/admin/pick-lists" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Pick Lists
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{pickList.pickListNumber}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pickList.sourceOrderId ? (
              <>
                Order{" "}
                <Link href={`/admin/orders/${pickList.sourceOrderId}`} className="text-primary hover:underline">
                  {pickList.sourceOrderNumber}
                </Link>
              </>
            ) : (
              "Manual pick list"
            )}
            {pickList.assignedTo && <> &middot; Assigned to {pickList.assignedTo}</>}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${cfg.bg} ${cfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {pickList.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Dates */}
      <div className="border rounded-xl bg-card p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs block mb-0.5">Created</span>
            <span className="font-medium">{pickList.createdAt ? format(new Date(pickList.createdAt), "MMM d, yyyy h:mm a") : "\u2014"}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block mb-0.5">Assigned</span>
            <span className="font-medium">{pickList.assignedAt ? format(new Date(pickList.assignedAt), "MMM d, yyyy h:mm a") : "\u2014"}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block mb-0.5">Started</span>
            <span className="font-medium">{pickList.startedAt ? format(new Date(pickList.startedAt), "MMM d, yyyy h:mm a") : "\u2014"}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block mb-0.5">Completed</span>
            <span className="font-medium">{pickList.completedAt ? format(new Date(pickList.completedAt), "MMM d, yyyy h:mm a") : "\u2014"}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        {pickList.status === "pending" && (
          <button
            onClick={() => { setAssignTo(""); setAssignDialog(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Assign
          </button>
        )}
        {pickList.status === "assigned" && (
          <button
            onClick={() => actionMutation.mutate({ action: "start" })}
            disabled={actionMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Play className="h-4 w-4" /> Start Picking
          </button>
        )}
        {canComplete && (
          <button
            onClick={() => actionMutation.mutate({ action: "complete" })}
            disabled={actionMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle className="h-4 w-4" /> Complete Pick List
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => setCancelDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-destructive/30 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 transition-colors"
          >
            <X className="h-4 w-4" /> Cancel
          </button>
        )}
      </div>

      {/* Items Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-3 bg-muted/40 border-b">
          <h2 className="font-semibold text-sm">Items ({pickList.items.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Part #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Bin</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Required</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Picked</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                {pickList.status === "in_progress" && (
                  <th className="w-24 p-3"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {pickList.items.length === 0 ? (
                <tr>
                  <td colSpan={pickList.status === "in_progress" ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    No items in this pick list
                  </td>
                </tr>
              ) : pickList.items.map((item) => {
                const icfg = itemStatusConfig[item.status] || { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" };
                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{item.productName}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{item.partNumber}</td>
                    <td className="p-3 font-mono text-xs">{item.binCode || "\u2014"}</td>
                    <td className="p-3 text-center font-medium">{item.quantityRequired}</td>
                    <td className="p-3 text-center font-medium">{item.quantityPicked}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${icfg.bg} ${icfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${icfg.dot}`} />
                        {item.status}
                      </span>
                    </td>
                    {pickList.status === "in_progress" && (
                      <td className="p-3">
                        {item.status === "pending" && (
                          <button
                            onClick={() => { setPickQuantity(String(item.quantityRequired)); setPickDialog(item); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                          >
                            <Package className="h-3.5 w-3.5" /> Pick
                          </button>
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

      {/* In-progress hint */}
      {pickList.status === "in_progress" && !allItemsResolved && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 border rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Pick all items (or mark as short/skipped) before completing the pick list.
        </div>
      )}

      {/* Assign Dialog */}
      {assignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAssignDialog(false)}>
          <div role="dialog" aria-modal="true" className="bg-card border rounded-xl p-6 w-full max-w-sm shadow-lg space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Assign Pick List</h3>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Picker name or ID</label>
              <input
                placeholder="e.g. John or EMP-001"
                className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAssignDialog(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
              <button
                onClick={() => actionMutation.mutate({ action: "assign", body: { assignedTo: assignTo } })}
                disabled={!assignTo.trim() || actionMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pick Item Dialog */}
      {pickDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPickDialog(null)}>
          <div role="dialog" aria-modal="true" className="bg-card border rounded-xl p-6 w-full max-w-sm shadow-lg space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Pick Item</h3>
            <div className="text-sm space-y-1">
              <p className="font-medium">{pickDialog.productName}</p>
              <p className="text-muted-foreground font-mono text-xs">{pickDialog.partNumber}</p>
              {pickDialog.binCode && <p className="text-muted-foreground text-xs">Bin: {pickDialog.binCode}</p>}
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Quantity picked (required: {pickDialog.quantityRequired})</label>
              <input
                type="number"
                min="0"
                max={pickDialog.quantityRequired}
                className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={pickQuantity}
                onChange={(e) => setPickQuantity(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPickDialog(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
              <button
                onClick={() => {
                  const qty = parseInt(pickQuantity, 10);
                  if (!isNaN(qty) && qty >= 0) {
                    pickItemMutation.mutate({ itemId: pickDialog.id, quantityPicked: qty });
                  }
                }}
                disabled={!pickQuantity || pickItemMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Confirm Pick
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      {cancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCancelDialog(false)}>
          <div role="dialog" aria-modal="true" className="bg-card border rounded-xl p-6 w-full max-w-sm shadow-lg space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Cancel Pick List</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to cancel this pick list? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelDialog(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">Back</button>
              <button
                onClick={() => actionMutation.mutate({ action: "cancel" })}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                Cancel Pick List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
