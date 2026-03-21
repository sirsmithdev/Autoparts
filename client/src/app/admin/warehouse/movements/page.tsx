"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft, ArrowRightLeft, Search, ChevronLeft, ChevronRight, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";

/* ---------- Types ---------- */

interface StockMovement {
  id: string;
  productName: string;
  partNumber: string;
  movementType: string;
  quantity: number;
  binCode: string | null;
  reference: string | null;
  performedBy: string | null;
  createdAt: string;
}

/* ---------- Movement Type Config ---------- */

const movementTypeConfig: Record<string, { bg: string; text: string; dot: string; sign: string }> = {
  received: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", sign: "+" },
  sold_online: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", sign: "-" },
  sold_pos: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", sign: "-" },
  returned: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", sign: "+" },
  transferred: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", sign: "" },
  adjusted_up: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", sign: "+" },
  adjusted_down: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", sign: "-" },
  damaged: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", sign: "-" },
};

const MOVEMENT_TYPES = [
  { value: "received", label: "Received" },
  { value: "sold_online", label: "Sold Online" },
  { value: "sold_pos", label: "Sold POS" },
  { value: "returned", label: "Returned" },
  { value: "transferred", label: "Transferred" },
  { value: "adjusted_up", label: "Adjusted Up" },
  { value: "adjusted_down", label: "Adjusted Down" },
  { value: "damaged", label: "Damaged" },
];

/* ---------- Main Page ---------- */

export default function StockMovementsPage() {
  const [productSearch, setProductSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const { data: movementsData, isLoading } = useQuery<{ movements: StockMovement[]; total: number }>({
    queryKey: ["warehouse-movements", productSearch, typeFilter, startDate, endDate, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (productSearch) params.set("productSearch", productSearch);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("page", String(page));
      params.set("limit", "20");
      return api<{ movements: StockMovement[]; total: number }>(`/api/store/admin/warehouse/movements?${params}`);
    },
  });

  const movements = movementsData?.movements || [];
  const total = movementsData?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <Link href="/admin/warehouse" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Warehouse
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Stock Movements</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Audit trail of all inventory changes</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search by product..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={productSearch}
            onChange={(e) => { setProductSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Types</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              className="pl-9 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              title="Start date"
            />
          </div>
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            title="End date"
          />
        </div>
      </div>

      {/* Movements Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Date / Time</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Quantity</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Bin</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Reference</th>
                <th className="text-left p-3 font-medium text-muted-foreground">By</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <ArrowRightLeft className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  No movements found
                </td></tr>
              ) : movements.map((movement) => {
                const cfg = movementTypeConfig[movement.movementType] || {
                  bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500", sign: "",
                };
                const qtyDisplay = `${cfg.sign}${Math.abs(movement.quantity)}`;
                const isPositive = cfg.sign === "+";
                const isNegative = cfg.sign === "-";

                return (
                  <tr key={movement.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(movement.createdAt), "MMM d, yyyy")}
                      <br />
                      <span className="text-xs">{format(new Date(movement.createdAt), "h:mm a")}</span>
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{movement.productName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{movement.partNumber}</p>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {movement.movementType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-semibold ${
                      isPositive ? "text-green-700" : isNegative ? "text-red-700" : ""
                    }`}>
                      {qtyDisplay}
                    </td>
                    <td className="p-3 font-mono text-xs">{movement.binCode || "\u2014"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{movement.reference || "\u2014"}</td>
                    <td className="p-3 text-muted-foreground">{movement.performedBy || "\u2014"}</td>
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
