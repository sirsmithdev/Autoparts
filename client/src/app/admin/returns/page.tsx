"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search, CheckCircle, X, RotateCcw, PackageCheck,
  DollarSign, Clock, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface ReturnStats {
  total: number;
  pending: number;
  approved: number;
  refunded: number;
}

interface StoreReturn {
  id: string;
  returnNumber: string;
  orderNumber: string | null;
  orderId: string;
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  reason: string;
  refundAmount: string | null;
  requestedAt: string | null;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  requested: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  approved: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  rejected: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  shipped_back: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  received: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  refunded: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  exchanged: { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
  closed: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" },
};

export default function AdminReturnsPage() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const [actionDialog, setActionDialog] = useState<{ type: "approve" | "reject"; returnId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [shippingPaidBy, setShippingPaidBy] = useState<"customer" | "store">("store");

  // Close dialogs on Escape
  const closeDialog = useCallback(() => setActionDialog(null), []);
  useEffect(() => {
    if (!actionDialog) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDialog(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [actionDialog, closeDialog]);

  const { data: stats } = useQuery<ReturnStats>({
    queryKey: ["admin-return-stats"],
    queryFn: () => api<ReturnStats>("/api/store/admin/returns/stats"),
  });

  const { data, isLoading } = useQuery<{ returns: StoreReturn[]; total: number }>({
    queryKey: ["admin-returns", status, search, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      params.set("page", String(page));
      return api<{ returns: StoreReturn[]; total: number }>(`/api/store/admin/returns?${params}`);
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ returnId, action, body }: { returnId: string; action: string; body?: Record<string, unknown> }) => {
      return api(`/api/store/admin/returns/${returnId}/${action}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      queryClient.invalidateQueries({ queryKey: ["admin-return-stats"] });
      setActionDialog(null);
    },
  });

  const returns = data?.returns || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Online Returns</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage customer return requests</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <RotateCcw className="h-4 w-4" />
              <span className="text-xs font-medium">Total Returns</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Pending Review</span>
            </div>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </div>
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <PackageCheck className="h-4 w-4" />
              <span className="text-xs font-medium">Approved</span>
            </div>
            <p className="text-2xl font-bold">{stats.approved}</p>
          </div>
          <div className="border rounded-md bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Refunded</span>
            </div>
            <p className="text-2xl font-bold">{stats.refunded}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search by return # or customer..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Statuses</option>
          <option value="requested">Requested</option>
          <option value="approved">Approved</option>
          <option value="shipped_back">Shipped Back</option>
          <option value="received">Received</option>
          <option value="refunded">Refunded</option>
          <option value="rejected">Rejected</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Returns Table */}
      <div className="border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Return #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Order #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Reason</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                <th className="p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : returns.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No returns found</td></tr>
              ) : returns.map((ret) => {
                const cfg = statusConfig[ret.status] || { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" };
                return (
                  <tr key={ret.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs font-semibold">{ret.returnNumber}</td>
                    <td className="p-3">
                      <Link href={`/admin/orders/${ret.orderId}`} className="text-primary hover:underline font-mono text-xs">
                        {ret.orderNumber || "View Order"}
                      </Link>
                    </td>
                    <td className="p-3">
                      <div>{ret.customerName || "\u2014"}</div>
                      {ret.customerEmail && <div className="text-xs text-muted-foreground">{ret.customerEmail}</div>}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {ret.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3 capitalize max-w-[150px] truncate text-muted-foreground">
                      {ret.reason.replace(/_/g, " ")}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {ret.refundAmount ? formatPrice(ret.refundAmount) : "\u2014"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {ret.requestedAt ? format(new Date(ret.requestedAt), "MMM d, yyyy") : "\u2014"}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {ret.status === "requested" && (
                          <>
                            <button
                              title="Approve"
                              onClick={() => { setShippingPaidBy("store"); setActionDialog({ type: "approve", returnId: ret.id }); }}
                              className="p-1.5 hover:bg-green-50 rounded transition-colors"
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </button>
                            <button
                              title="Reject"
                              onClick={() => { setRejectReason(""); setActionDialog({ type: "reject", returnId: ret.id }); }}
                              className="p-1.5 hover:bg-red-50 rounded transition-colors"
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </button>
                          </>
                        )}
                        {ret.status === "approved" && (
                          <button
                            onClick={() => { if (!window.confirm("Mark this return as received?")) return; actionMutation.mutate({ returnId: ret.id, action: "receive" }); }}
                            disabled={actionMutation.isPending}
                            className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40"
                          >
                            Received
                          </button>
                        )}
                        {ret.status === "received" && (
                          <button
                            onClick={() => { if (!window.confirm("Issue a refund for this return?")) return; actionMutation.mutate({ returnId: ret.id, action: "refund" }); }}
                            disabled={actionMutation.isPending}
                            className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40"
                          >
                            Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="inline-flex items-center gap-1 px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-sm text-muted-foreground px-3">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="inline-flex items-center gap-1 px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Approve Dialog */}
      {actionDialog?.type === "approve" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setActionDialog(null)} />
          <div role="dialog" aria-modal="true" className="relative bg-card border rounded-md shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Approve Return</h3>
            <div className="space-y-3">
              <label className="text-sm font-medium block">Return shipping paid by:</label>
              <select
                value={shippingPaidBy}
                onChange={(e) => setShippingPaidBy(e.target.value as "customer" | "store")}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="store">Store</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setActionDialog(null)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => actionMutation.mutate({
                  returnId: actionDialog.returnId,
                  action: "approve",
                  body: { returnShippingPaidBy: shippingPaidBy },
                })}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {actionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {actionDialog?.type === "reject" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setActionDialog(null)} />
          <div role="dialog" aria-modal="true" className="relative bg-card border rounded-md shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Reject Return</h3>
            <textarea
              placeholder="Reason for rejection"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setActionDialog(null)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => actionMutation.mutate({
                  returnId: actionDialog.returnId,
                  action: "reject",
                  body: { reason: rejectReason },
                })}
                disabled={!rejectReason || actionMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {actionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
