"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, ScanBarcode } from "lucide-react";
import { api } from "@/lib/api";

interface Category {
  id: string;
  name: string;
}

export default function AdminNewProductPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    partNumber: "",
    barcode: "",
    salePrice: "",
    category: "",
    manufacturer: "",
    condition: "new" as "new" | "refurbished" | "used",
    description: "",
    weight: "",
    isOversized: false,
    isFeatured: false,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["admin-categories"],
    queryFn: () => api<Category[]>("/api/store/categories"),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ product: { id: string } }>("/api/store/admin/products", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      router.push(`/admin/products/${data.product.id}`);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.partNumber.trim() || !form.salePrice.trim()) {
      setError("Name, part number, and sale price are required.");
      return;
    }

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      partNumber: form.partNumber.trim(),
      salePrice: parseFloat(form.salePrice),
      condition: form.condition,
      isOversized: form.isOversized,
      isFeatured: form.isFeatured,
    };
    if (form.barcode.trim()) body.barcode = form.barcode.trim();
    if (form.category) body.category = form.category;
    if (form.manufacturer.trim()) body.manufacturer = form.manufacturer.trim();
    if (form.description.trim()) body.description = form.description.trim();
    if (form.weight.trim()) body.weight = parseFloat(form.weight);

    createMutation.mutate(body);
  };

  const update = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/products" className="p-1.5 hover:bg-accent rounded transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Add Product</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create a new product in the catalog</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="border rounded-lg bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Brake Pad Set - Front"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Part Number *</label>
              <input
                type="text"
                value={form.partNumber}
                onChange={(e) => update("partNumber", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. BP-1234"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Barcode</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(e) => update("barcode", e.target.value)}
                  className="w-full px-3 py-2 pr-10 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Scan or enter barcode"
                />
                <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Sale Price *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.salePrice}
                onChange={(e) => update("salePrice", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">None</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Manufacturer</label>
              <input
                type="text"
                value={form.manufacturer}
                onChange={(e) => update("manufacturer", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Brembo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Condition</label>
              <select
                value={form.condition}
                onChange={(e) => update("condition", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="new">New</option>
                <option value="refurbished">Refurbished</option>
                <option value="used">Used</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-vertical"
              placeholder="Product description..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.weight}
                onChange={(e) => update("weight", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isOversized}
                onChange={(e) => update("isOversized", e.target.checked)}
                className="rounded"
              />
              Oversized item
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => update("isFeatured", e.target.checked)}
                className="rounded"
              />
              Featured product
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/admin/products"
            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {createMutation.isPending ? "Creating..." : "Create Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
