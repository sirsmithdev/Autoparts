"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, Plus, ScanBarcode, Edit2, Trash2, ChevronLeft, ChevronRight,
  Image as ImageIcon, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  partNumber: string;
  barcode: string | null;
  salePrice: string;
  stockQuantity: number;
  category: string | null;
  isActive: boolean;
  thumbnailUrl: string | null;
}

interface Category {
  id: string;
  name: string;
}

const statusBadge = (active: boolean) =>
  active
    ? "bg-green-50 text-green-700"
    : "bg-gray-100 text-gray-500";

export default function AdminProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [page, setPage] = useState(1);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const limit = 20;

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["admin-categories"],
    queryFn: () => api<Category[]>("/api/store/categories"),
  });

  const { data: productsData, isLoading } = useQuery<{ products: Product[]; total: number }>({
    queryKey: ["admin-products", search, category, isActive, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      params.set("isActive", String(isActive));
      params.set("page", String(page));
      params.set("limit", String(limit));
      return api<{ products: Product[]; total: number }>(`/api/store/admin/products?${params}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/store/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setDeleteConfirm(null);
    },
  });

  const products = productsData?.products || [];
  const total = productsData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleScan = async () => {
    setScanError("");
    if (!scanValue.trim()) return;
    try {
      const result = await api<{ product: { id: string } | null }>(
        `/api/store/admin/products?search=${encodeURIComponent(scanValue.trim())}&limit=1`
      );
      if (result.product) {
        router.push(`/admin/products/${result.product.id}`);
        setScanOpen(false);
      } else {
        // Try searching products list
        const listResult = await api<{ products: Product[]; total: number }>(
          `/api/store/admin/products?search=${encodeURIComponent(scanValue.trim())}&limit=1`
        );
        if (listResult.products?.length) {
          router.push(`/admin/products/${listResult.products[0].id}`);
          setScanOpen(false);
        } else {
          setScanError("No product found with that barcode.");
        }
      }
    } catch {
      setScanError("Failed to look up barcode.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage product catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setScanOpen(true); setScanValue(""); setScanError(""); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            <ScanBarcode className="h-4 w-4" /> Scan Barcode
          </button>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Product
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search name, part number, barcode..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer select-none hover:bg-accent transition-colors">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => { setIsActive(e.target.checked); setPage(1); }}
            className="rounded"
          />
          Active only
        </label>
      </div>

      {/* Products Table */}
      <div className="border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground w-12"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Part Number</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Barcode</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Price</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Stock</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="w-20 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No products found</td></tr>
              ) : products.map((product) => (
                <tr key={product.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    {product.thumbnailUrl ? (
                      <img src={product.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-medium">{product.name}</td>
                  <td className="p-3 font-mono text-xs">{product.partNumber}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{product.barcode || "\u2014"}</td>
                  <td className="p-3 text-right font-medium">{formatPrice(product.salePrice)}</td>
                  <td className="p-3 text-right">{product.stockQuantity}</td>
                  <td className="p-3 text-muted-foreground">{product.category || "\u2014"}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge(product.isActive)}`}>
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="p-1.5 hover:bg-accent rounded transition-colors inline-flex"
                        title="Edit product"
                      >
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      </Link>
                      <button
                        onClick={() => setDeleteConfirm(product.id)}
                        className="p-1.5 hover:bg-red-50 rounded transition-colors inline-flex"
                        title="Delete product"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {/* Scan Barcode Modal */}
      {scanOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 w-full max-w-sm shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Scan Barcode</h3>
              <button onClick={() => setScanOpen(false)} className="p-1 hover:bg-accent rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              autoFocus
              placeholder="Enter or scan barcode..."
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring mb-3"
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleScan(); }}
            />
            {scanError && <p className="text-sm text-red-600 mb-3">{scanError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setScanOpen(false)}
                className="px-3 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleScan}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Look Up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Delete Product</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
