"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";

interface ActivityEntry {
  id: string;
  actionType: string;
  description: string;
  performedBy: string | null;
  createdAt: string;
}

const actionBadge: Record<string, { bg: string; text: string }> = {
  stock_adjustment: { bg: "bg-blue-50", text: "text-blue-700" },
  stock_decrement: { bg: "bg-orange-50", text: "text-orange-700" },
  stock_restore: { bg: "bg-green-50", text: "text-green-700" },
  stock_receipt: { bg: "bg-cyan-50", text: "text-cyan-700" },
  price_change: { bg: "bg-purple-50", text: "text-purple-700" },
  product_update: { bg: "bg-indigo-50", text: "text-indigo-700" },
  product_create: { bg: "bg-emerald-50", text: "text-emerald-700" },
  sync_inbound: { bg: "bg-yellow-50", text: "text-yellow-700" },
  sync_outbound: { bg: "bg-amber-50", text: "text-amber-700" },
};

export default function AdminProductActivityPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading } = useQuery<{ activity: ActivityEntry[]; total: number }>({
    queryKey: ["admin-product-activity", id, page],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      return api<{ activity: ActivityEntry[]; total: number }>(
        `/api/store/admin/products/${id}/activity?${params}`
      );
    },
  });

  const activity = data?.activity || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/products/${id}`} className="p-1.5 hover:bg-accent rounded transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Stock movements and admin actions for this product
          </p>
        </div>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden max-w-3xl">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : activity.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No activity recorded yet.</div>
        ) : (
          <div className="divide-y">
            {activity.map((entry) => {
              const badge = actionBadge[entry.actionType] || { bg: "bg-gray-50", text: "text-gray-700" };
              return (
                <div key={entry.id} className="flex items-start gap-4 p-4">
                  <div className="shrink-0 pt-0.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 mt-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                        {entry.actionType.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{entry.description}</p>
                    {entry.performedBy && (
                      <p className="text-xs text-muted-foreground mt-0.5">by {entry.performedBy}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="inline-flex items-center gap-1 px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-sm text-muted-foreground px-3">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
