"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PartCard } from "@/components/PartCard";
import { CategorySidebar } from "@/components/CategorySidebar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PartGridSkeleton } from "@/components/PartCardSkeleton";
import { Suspense } from "react";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";

interface CatalogResult {
  parts: Array<{
    id: string; name: string; partNumber: string; salePrice: string;
    category?: string | null; manufacturer?: string | null; imageUrl?: string | null;
    stockStatus: string; condition?: string;
  }>;
  total: number; page: number; pageSize: number;
}

const SORT_OPTIONS = [
  { value: "name", label: "Name A–Z" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
] as const;

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const make = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";
  const year = searchParams.get("year") || "";
  const manufacturer = searchParams.get("manufacturer") || "";
  const condition = searchParams.get("condition") || "";
  const inStockOnly = searchParams.get("inStockOnly") === "true";
  const orderBy = (searchParams.get("orderBy") || "name") as (typeof SORT_OPTIONS)[number]["value"];
  const page = parseInt(searchParams.get("page") || "1");

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (make) params.set("make", make);
  if (model) params.set("model", model);
  if (year) params.set("year", year);
  if (manufacturer) params.set("manufacturer", manufacturer);
  if (condition) params.set("condition", condition);
  if (inStockOnly) params.set("inStockOnly", "true");
  if (orderBy && orderBy !== "name") params.set("orderBy", orderBy);
  params.set("page", String(page));
  params.set("limit", "20");

  const { data, isLoading } = useQuery<CatalogResult>({
    queryKey: ["catalog-search", q, category, make, model, year, manufacturer, condition, inStockOnly, orderBy, page],
    queryFn: () => api(`/api/store/catalog?${params}`),
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["store-categories"],
    queryFn: () => api("/api/store/categories"),
  });

  const { data: manufacturers = [] } = useQuery<string[]>({
    queryKey: ["store-manufacturers"],
    queryFn: () => api("/api/store/catalog/manufacturers"),
  });

  const parts = data?.parts || [];
  const total = data?.total || 0;
  const pageSize = data?.pageSize || 20;
  const totalPages = Math.ceil(total / pageSize);

  const updateParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete("page");
    router.push(`/search?${p}`);
  };

  const breadcrumbs: { label: string; href?: string }[] = [
    { label: "Home", href: "/" },
    { label: "Search", href: "/search" },
  ];
  if (category) breadcrumbs.push({ label: category });
  else if (q) breadcrumbs.push({ label: `"${q}"` });
  else if (make) breadcrumbs.push({ label: `${year} ${make} ${model}` });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Breadcrumbs items={breadcrumbs} />

      {/* Mobile category selector */}
      <div className="lg:hidden">
        <select
          value={category}
          onChange={(e) => updateParam("category", e.target.value)}
          className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex gap-8">
        <CategorySidebar categories={categories} className="hidden lg:block" />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">
                {q ? `Results for "${q}"` : make ? `Parts for ${year} ${make} ${model}` : category || "All Parts"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {total} part{total !== 1 ? "s" : ""} found
              </p>
            </div>
            <select
              value={orderBy}
              onChange={(e) => updateParam("orderBy", e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-auto"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-muted/50 rounded-lg">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => updateParam("inStockOnly", e.target.checked ? "true" : "")}
                className="rounded border-gray-300"
              />
              In stock only
            </label>
            <select
              value={condition}
              onChange={(e) => updateParam("condition", e.target.value)}
              className="border rounded-md px-2.5 py-1.5 text-sm bg-background"
            >
              <option value="">All conditions</option>
              <option value="new">New</option>
              <option value="refurbished">Refurbished</option>
              <option value="used">Used</option>
            </select>
            <select
              value={manufacturer}
              onChange={(e) => updateParam("manufacturer", e.target.value)}
              className="border rounded-md px-2.5 py-1.5 text-sm bg-background"
            >
              <option value="">All manufacturers</option>
              {manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Results */}
          {isLoading ? (
            <PartGridSkeleton count={8} />
          ) : parts.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Search className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-lg font-medium">No parts found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {parts.map((part) => <PartCard key={part.id} {...part} />)}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                disabled={page <= 1}
                onClick={() => {
                  const p = new URLSearchParams(searchParams);
                  p.set("page", String(page - 1));
                  router.push(`/search?${p}`);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 border rounded-md text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-sm text-muted-foreground px-3">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  const p = new URLSearchParams(searchParams);
                  p.set("page", String(page + 1));
                  router.push(`/search?${p}`);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 border rounded-md text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 sm:px-6 py-8"><PartGridSkeleton /></div>}>
      <SearchContent />
    </Suspense>
  );
}
