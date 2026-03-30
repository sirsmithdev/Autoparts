"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Loader2, Package, CheckCircle,
  X, Search, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

/* ---------- Types ---------- */

interface WarehouseBin {
  id: string;
  binCode: string;
  locationName: string;
}

interface ProductLookup {
  id: string;
  name: string;
  partNumber: string;
}

interface LineItem {
  key: string;
  productId: string;
  productName: string;
  partNumber: string;
  binId: string;
  quantity: number;
  unitCost: string;
}

interface ReceiptItem {
  id: string;
  productName: string;
  partNumber: string;
  binCode: string;
  quantity: number;
  unitCost: string;
}

interface Receipt {
  id: string;
  receiptNumber: string;
  status: string;
  supplierName: string | null;
  notes: string | null;
  itemCount: number;
  createdAt: string;
  items?: ReceiptItem[];
}

/* ---------- Status Config ---------- */

const receiptStatusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  received: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  cancelled: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

/* ---------- Product Search Autocomplete ---------- */

function ProductSearch({
  onSelect,
}: {
  onSelect: (product: ProductLookup) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: results = [] } = useQuery<ProductLookup[]>({
    queryKey: ["product-lookup", query],
    queryFn: () => api<ProductLookup[]>(`/api/store/pos/lookup?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search products..."
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg max-h-48 overflow-auto">
          {results.map((p) => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
              onClick={() => {
                onSelect(p);
                setQuery("");
                setOpen(false);
              }}
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground font-mono text-xs">{p.partNumber}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Create Receipt Form ---------- */

interface Supplier {
  id: string;
  name: string;
  isActive: boolean;
}

function CreateReceiptForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  let nextKey = useRef(0);

  const { data: bins = [] } = useQuery<WarehouseBin[]>({
    queryKey: ["warehouse-bins", "all"],
    queryFn: () => api<WarehouseBin[]>("/api/store/admin/warehouse/bins"),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["admin-suppliers"],
    queryFn: () => api<Supplier[]>("/api/store/admin/suppliers"),
  });

  const addLineItem = useCallback((product: ProductLookup) => {
    setLineItems((prev) => [
      ...prev,
      {
        key: String(nextKey.current++),
        productId: product.id,
        productName: product.name,
        partNumber: product.partNumber,
        binId: bins[0]?.id || "",
        quantity: 1,
        unitCost: "0.00",
      },
    ]);
  }, [bins]);

  const updateLineItem = useCallback((key: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  }, []);

  const removeLineItem = useCallback((key: string) => {
    setLineItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const createMutation = useMutation({
    mutationFn: async (action: "draft" | "receive") => {
      return api("/api/store/admin/warehouse/receipts", {
        method: "POST",
        body: JSON.stringify({
          supplierId: supplierId || null,
          notes: notes || null,
          action,
          items: lineItems.map(({ productId, binId, quantity, unitCost }) => ({
            productId,
            binId,
            quantity,
            unitCost,
          })),
        }),
      });
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-receipts"] });
      toast({ title: action === "draft" ? "Draft receipt created" : "Stock received successfully" });
      setSupplierId("");
      setNotes("");
      setLineItems([]);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="border rounded-md bg-card overflow-hidden">
      <div className="px-5 py-3 bg-muted/40 border-b">
        <h2 className="font-semibold text-sm">Create Receipt</h2>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Supplier</label>
            {suppliers.filter((s) => s.isActive).length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                No suppliers found. <Link href="/admin/suppliers" className="text-primary hover:underline">Add a supplier first</Link>
              </p>
            ) : (
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Select supplier (optional)</option>
                {suppliers.filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Notes</label>
            <input
              placeholder="Optional"
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Line Items</label>
          <ProductSearch onSelect={addLineItem} />
        </div>

        {lineItems.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-2.5 font-medium text-muted-foreground">Product</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground w-40">Bin</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground w-24">Qty</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground w-28">Unit Cost</th>
                  <th className="w-10 p-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.key} className="border-b last:border-0">
                    <td className="p-2.5">
                      <div>
                        <p className="font-medium text-sm">{item.productName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.partNumber}</p>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <select
                        className="w-full border rounded px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={item.binId}
                        onChange={(e) => updateLineItem(item.key, "binId", e.target.value)}
                      >
                        <option value="">Select bin</option>
                        {bins.map((bin) => (
                          <option key={bin.id} value={bin.id}>
                            {bin.binCode} ({bin.locationName})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2.5">
                      <input
                        type="number"
                        min={1}
                        className="w-full border rounded px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.key, "quantity", parseInt(e.target.value) || 1)}
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="w-full border rounded px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={item.unitCost}
                        onChange={(e) => updateLineItem(item.key, "unitCost", e.target.value)}
                      />
                    </td>
                    <td className="p-2.5">
                      <button
                        onClick={() => removeLineItem(item.key)}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lineItems.length > 0 && (
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => createMutation.mutate("draft")}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create Draft
            </button>
            <button
              onClick={() => createMutation.mutate("receive")}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              Receive Stock
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Receipt Detail ---------- */

function ReceiptDetail({
  receipt,
  onClose,
}: {
  receipt: Receipt;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: detail, isLoading } = useQuery<Receipt>({
    queryKey: ["warehouse-receipt", receipt.id],
    queryFn: () => api<Receipt>(`/api/store/admin/warehouse/receipts/${receipt.id}`),
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const confirmMutation = useMutation({
    mutationFn: () => api(`/api/store/admin/warehouse/receipts/${receipt.id}/receive`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-receipt", receipt.id] });
      toast({ title: "Stock received successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api(`/api/store/admin/warehouse/receipts/${receipt.id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-receipt", receipt.id] });
      toast({ title: "Receipt cancelled" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-card border rounded-md w-full max-w-lg shadow-lg max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/40">
          <h3 className="font-bold">{receipt.receiptNumber}</h3>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 text-sm">
            {(() => {
              const cfg = receiptStatusConfig[detail?.status || receipt.status] || receiptStatusConfig.draft;
              return (
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {(detail?.status || receipt.status).replace(/_/g, " ")}
                </span>
              );
            })()}
            <span className="text-muted-foreground">{format(new Date(receipt.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
          </div>
          {(detail?.supplierName || receipt.supplierName) && (
            <p className="text-sm"><span className="text-muted-foreground">Supplier:</span> {detail?.supplierName || receipt.supplierName}</p>
          )}
          {(detail?.notes || receipt.notes) && (
            <p className="text-sm"><span className="text-muted-foreground">Notes:</span> {detail?.notes || receipt.notes}</p>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading items...
            </div>
          ) : detail?.items && detail.items.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-2.5 font-medium text-muted-foreground">Product</th>
                    <th className="text-left p-2.5 font-medium text-muted-foreground">Bin</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">Qty</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="p-2.5">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.partNumber}</p>
                      </td>
                      <td className="p-2.5 font-mono text-xs">{item.binCode}</td>
                      <td className="p-2.5 text-right">{item.quantity}</td>
                      <td className="p-2.5 text-right">{item.unitCost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {(detail?.status || receipt.status) === "draft" && (
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending || confirmMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 border border-destructive/30 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 disabled:opacity-50 transition-colors"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
              <button
                onClick={() => { if (!window.confirm("Confirm receipt and add stock to inventory?")) return; confirmMutation.mutate(); }}
                disabled={confirmMutation.isPending || cancelMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Confirm Receipt
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function GoodsReceiptPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const { data: receiptsData, isLoading } = useQuery<{ receipts: Receipt[]; total: number }>({
    queryKey: ["warehouse-receipts", statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      return api<{ receipts: Receipt[]; total: number }>(`/api/store/admin/warehouse/receipts?${params}`);
    },
  });

  const receipts = receiptsData?.receipts || [];
  const total = receiptsData?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <Link href="/admin/warehouse" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Warehouse
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Goods Receipt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Receive new stock into the warehouse</p>
      </div>

      {/* Create Receipt Form */}
      <CreateReceiptForm />

      {/* Receipt History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Receipt History</h2>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="border rounded-md bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium text-muted-foreground">Receipt #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Supplier</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Items</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                  <th className="w-10 p-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                ) : receipts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No receipts found</td></tr>
                ) : receipts.map((receipt) => {
                  const cfg = receiptStatusConfig[receipt.status] || receiptStatusConfig.draft;
                  return (
                    <tr
                      key={receipt.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedReceipt(receipt)}
                    >
                      <td className="p-3 font-mono text-xs font-semibold">{receipt.receiptNumber}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {receipt.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{receipt.supplierName || "\u2014"}</td>
                      <td className="p-3 text-right">{receipt.itemCount}</td>
                      <td className="p-3 text-muted-foreground">{format(new Date(receipt.createdAt), "MMM d, yyyy")}</td>
                      <td className="p-3">
                        <button className="p-1.5 hover:bg-accent rounded transition-colors" title="View">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

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

      {/* Receipt Detail Dialog */}
      {selectedReceipt && (
        <ReceiptDetail receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}
    </div>
  );
}
