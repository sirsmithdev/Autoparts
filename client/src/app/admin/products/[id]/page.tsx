"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Trash2, Plus, X, Upload, Image as ImageIcon, History,
  ScanBarcode,
} from "lucide-react";
import { api, getAccessToken } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface ProductImage {
  id: string;
  url: string;
  sortOrder: number;
}

interface PartNumber {
  id?: string;
  partNumber: string;
  numberType: string;
  brand: string;
  isPrimary: boolean;
}

interface Compatibility {
  id?: string;
  make: string;
  model: string;
  yearStart: string;
  yearEnd: string;
  trim: string;
  engineType: string;
}

interface ProductData {
  id: string;
  name: string;
  partNumber: string;
  barcode: string | null;
  salePrice: string;
  quantity: number;
  category: string | null;
  manufacturer: string | null;
  condition: string;
  description: string | null;
  weight: string | null;
  isOversized: boolean;
  isFeatured: boolean;
  isActive: boolean;
}

interface ProductDetail {
  product: ProductData;
  images: Array<{ id: string; imageUrl: string; sortOrder: number; altText?: string; isPrimary: boolean }>;
  numbers: PartNumber[];
  compatibility: Compatibility[];
}

export default function AdminEditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Basic info form state
  const [form, setForm] = useState({
    name: "",
    partNumber: "",
    barcode: "",
    salePrice: "",
    category: "",
    manufacturer: "",
    condition: "new",
    description: "",
    weight: "",
    isOversized: false,
    isFeatured: false,
    isActive: true,
  });

  // Part numbers and compatibility state
  const [numbers, setNumbers] = useState<PartNumber[]>([]);
  const [compatibility, setCompatibility] = useState<Compatibility[]>([]);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["admin-categories"],
    queryFn: () => api<Category[]>("/api/store/categories"),
  });

  const { data: product, isLoading } = useQuery<ProductDetail>({
    queryKey: ["admin-product", id],
    queryFn: () => api<ProductDetail>(`/api/store/admin/products/${id}`),
  });

  // Populate form when product loads
  const p = product?.product;
  useEffect(() => {
    if (p) {
      setForm({
        name: p.name,
        partNumber: p.partNumber,
        barcode: p.barcode || "",
        salePrice: p.salePrice,
        category: p.category || "",
        manufacturer: p.manufacturer || "",
        condition: p.condition || "new",
        description: p.description || "",
        weight: p.weight || "",
        isOversized: p.isOversized,
        isFeatured: p.isFeatured,
        isActive: p.isActive,
      });
      setNumbers(product?.numbers || []);
      setCompatibility(product?.compatibility || []);
    }
  }, [product, p]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/api/store/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product", id] });
      showSuccess("Product updated.");
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) =>
      api(`/api/store/admin/products/${id}/images/${imageId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product", id] });
    },
  });

  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("images", file);
      }
      const token = getAccessToken();
      await fetch(`/api/store/admin/products/${id}/images`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-product", id] });
    } catch {
      setError("Failed to upload images.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveNumbersMutation = useMutation({
    mutationFn: (nums: PartNumber[]) =>
      api(`/api/store/admin/products/${id}/numbers`, {
        method: "PUT",
        body: JSON.stringify({ numbers: nums }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product", id] });
      showSuccess("Part numbers saved.");
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveCompatibilityMutation = useMutation({
    mutationFn: (items: Compatibility[]) =>
      api(`/api/store/admin/products/${id}/compatibility`, {
        method: "PUT",
        body: JSON.stringify({ compatibility: items }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product", id] });
      showSuccess("Compatibility saved.");
    },
    onError: (err: Error) => setError(err.message),
  });

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setError("");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.partNumber.trim() || !form.salePrice) {
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
      isActive: form.isActive,
    };
    if (form.barcode.trim()) body.barcode = form.barcode.trim();
    else body.barcode = null;
    if (form.category) body.category = form.category;
    else body.category = null;
    if (form.manufacturer.trim()) body.manufacturer = form.manufacturer.trim();
    else body.manufacturer = null;
    if (form.description.trim()) body.description = form.description.trim();
    else body.description = null;
    if (form.weight) body.weight = parseFloat(form.weight);
    else body.weight = null;

    updateMutation.mutate(body);
  };

  const update = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  // Part number helpers
  const addNumber = () =>
    setNumbers((prev) => [...prev, { partNumber: "", numberType: "oem", brand: "", isPrimary: false }]);
  const removeNumber = (idx: number) => setNumbers((prev) => prev.filter((_, i) => i !== idx));
  const updateNumber = (idx: number, field: string, value: unknown) =>
    setNumbers((prev) => prev.map((n, i) => (i === idx ? { ...n, [field]: value } : n)));

  // Compatibility helpers
  const addCompatibility = () =>
    setCompatibility((prev) => [...prev, { make: "", model: "", yearStart: "", yearEnd: "", trim: "", engineType: "" }]);
  const removeCompatibility = (idx: number) => setCompatibility((prev) => prev.filter((_, i) => i !== idx));
  const updateCompatibility = (idx: number, field: string, value: string) =>
    setCompatibility((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Product not found.</p>
        <Link href="/admin/products" className="text-primary underline text-sm mt-2 inline-block">
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" className="p-1.5 hover:bg-accent rounded transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Edit Product</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{p?.name}</p>
          </div>
        </div>
        <Link
          href={`/admin/products/${id}/activity`}
          className="inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
        >
          <History className="h-4 w-4" /> Activity Log
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-3 text-sm">
          {successMsg}
        </div>
      )}

      {/* Basic Info Form */}
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="border rounded-lg bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => update("isActive", e.target.checked)}
                className="rounded"
              />
              Active
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Images Section */}
      <div className="border rounded-lg bg-card p-6 space-y-4 max-w-2xl">
        <h2 className="text-lg font-semibold">Images</h2>

        {product.images?.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {product.images.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.imageUrl}
                  alt=""
                  className="w-full aspect-square rounded-lg object-cover border"
                />
                <button
                  onClick={() => { if (!window.confirm("Delete this image?")) return; deleteImageMutation.mutate(img.id); }}
                  className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No images uploaded yet.</p>
        )}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload Images"}
          </button>
        </div>
      </div>

      {/* Part Numbers Section */}
      <div className="border rounded-lg bg-card p-6 space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Part Numbers</h2>
          <button
            type="button"
            onClick={addNumber}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {numbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No additional part numbers.</p>
        ) : (
          <div className="space-y-3">
            {numbers.map((num, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-2 items-center">
                <input
                  type="text"
                  value={num.partNumber}
                  onChange={(e) => updateNumber(idx, "partNumber", e.target.value)}
                  placeholder="Part number"
                  className="px-2 py-1.5 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <select
                  value={num.numberType}
                  onChange={(e) => updateNumber(idx, "numberType", e.target.value)}
                  className="px-2 py-1.5 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="oem">OEM</option>
                  <option value="aftermarket">Aftermarket</option>
                  <option value="cross_reference">Cross Ref</option>
                </select>
                <input
                  type="text"
                  value={num.brand}
                  onChange={(e) => updateNumber(idx, "brand", e.target.value)}
                  placeholder="Brand"
                  className="px-2 py-1.5 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={num.isPrimary}
                    onChange={(e) => updateNumber(idx, "isPrimary", e.target.checked)}
                    className="rounded"
                  />
                  Primary
                </label>
                <button
                  type="button"
                  onClick={() => removeNumber(idx)}
                  className="p-1 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {numbers.length > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => saveNumbersMutation.mutate(numbers)}
              disabled={saveNumbersMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saveNumbersMutation.isPending ? "Saving..." : "Save Part Numbers"}
            </button>
          </div>
        )}
      </div>

      {/* Compatibility Section */}
      <div className="border rounded-lg bg-card p-6 space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Vehicle Compatibility</h2>
          <button
            type="button"
            onClick={addCompatibility}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {compatibility.length === 0 ? (
          <p className="text-sm text-muted-foreground">No compatibility entries.</p>
        ) : (
          <div className="space-y-3">
            {compatibility.map((entry, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={entry.make}
                    onChange={(e) => updateCompatibility(idx, "make", e.target.value)}
                    placeholder="Make"
                    className="px-2 py-1.5 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={entry.model}
                    onChange={(e) => updateCompatibility(idx, "model", e.target.value)}
                    placeholder="Model"
                    className="px-2 py-1.5 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={entry.trim}
                    onChange={(e) => updateCompatibility(idx, "trim", e.target.value)}
                    placeholder="Trim"
                    className="px-2 py-1.5 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={entry.yearStart}
                    onChange={(e) => updateCompatibility(idx, "yearStart", e.target.value)}
                    placeholder="Year start"
                    className="px-2 py-1.5 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={entry.yearEnd}
                    onChange={(e) => updateCompatibility(idx, "yearEnd", e.target.value)}
                    placeholder="Year end"
                    className="px-2 py-1.5 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={entry.engineType}
                    onChange={(e) => updateCompatibility(idx, "engineType", e.target.value)}
                    placeholder="Engine type"
                    className="px-2 py-1.5 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeCompatibility(idx)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {compatibility.length > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => saveCompatibilityMutation.mutate(compatibility)}
              disabled={saveCompatibilityMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saveCompatibilityMutation.isPending ? "Saving..." : "Save Compatibility"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
