"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, Eye, ClipboardList, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";

interface PickList {
  id: string;
  pickListNumber: string;
  status: string;
  sourceOrderNumber: string | null;
  sourceOrderId: string | null;
  assignedTo: string | null;
  createdAt: string | null;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  assigned: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  in_progress: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  completed: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  cancelled: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" },
};

export default function AdminPickListsPage() {
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ pickLists: PickList[]; total: number }>({
    queryKey: ["admin-pick-lists", status, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      params.set("page", String(page));
      params.set("limit", "20");
      return api<{ pickLists: PickList[]; total: number }>(`/api/store/admin/pick-lists?${params}`);
    },
  });

  const pickLists = data?.pickLists || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pick Lists</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage warehouse pick lists and fulfillment</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Pick Lists Table */}
      <div className="border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Pick List #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Source Order</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Assigned To</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Created</th>
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  </td>
                </tr>
              ) : pickLists.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    No pick lists found
                  </td>
                </tr>
              ) : pickLists.map((pl) => {
                const cfg = statusConfig[pl.status] || { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" };
                return (
                  <tr key={pl.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs font-semibold">{pl.pickListNumber}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {pl.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3">
                      {pl.sourceOrderId ? (
                        <Link
                          href={`/admin/orders/${pl.sourceOrderId}`}
                          className="text-primary hover:underline text-xs font-mono"
                        >
                          {pl.sourceOrderNumber || "View Order"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{pl.assignedTo || "\u2014"}</td>
                    <td className="p-3 text-muted-foreground">
                      {pl.createdAt ? format(new Date(pl.createdAt), "MMM d, yyyy") : "\u2014"}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/pick-lists/${pl.id}`}
                        className="p-1.5 hover:bg-accent rounded transition-colors inline-flex"
                        title="View pick list"
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Link>
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
    </div>
  );
}
