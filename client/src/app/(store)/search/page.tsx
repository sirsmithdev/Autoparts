"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PartCard } from "@/components/PartCard";
import { CategorySidebar } from "@/components/CategorySidebar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PartGridSkeleton } from "@/components/PartCardSkeleton";
import { Suspense } from "react";
import { Search, ChevronLeft, ChevronRight, Headphones, Cog, Zap } from "lucide-react";
import Link from "next/link";

interface CatalogResult {
  parts: Array<{
    id: string; name: string; partNumber: string; salePrice: string;
    category?: string | null; manufacturer?: string | null; imageUrl?: string | null;
    stockStatus: string; condition?: string;
  }>;
  total: number; page: number; pageSize: number;
}

const SORT_OPTIONS = [
  { value: "name", label: "Name A\u2013Z" },
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
    { label: "Shop", href: "/search" },
  ];
  if (category) breadcrumbs.push({ label: category });
  else if (q) breadcrumbs.push({ label: `"${q}"` });
  else if (make) breadcrumbs.push({ label: `${year} ${make} ${model}` });

  const isDefaultView = !q && !category && !make;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Breadcrumbs items={breadcrumbs} />

      {/* Page title */}
      <h1 className="text-2xl font-bold text-center">Shop</h1>

      {/* Featured category banners - only on default shop view */}
      {isDefaultView && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Featured Products", icon: Cog, href: "/search?featured=true", color: "from-blue-500/10 to-blue-600/5" },
            { label: "Aftermarket Items", icon: Headphones, href: "/search?condition=new", color: "from-orange-500/10 to-orange-600/5" },
            { label: "Electrical Parts", icon: Zap, href: "/search?category=Electrical", color: "from-green-500/10 to-green-600/5" },
          ].map(({ label, icon: Icon, href, color }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-4 p-5 rounded-lg bg-gradient-to-r ${color} border hover:shadow-md transition-shadow`}
            >
              <Icon className="h-10 w-10 text-muted-foreground/60" />
              <span className="font-semibold text-sm">{label}</span>
            </Link>
          ))}
        </div>
      )}

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
              <h2 className="text-lg font-semibold">
                {q ? `Results for "${q}"` : make ? `Parts for ${year} ${make} ${model}` : category || "All Parts"}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {total} part{total !== 1 ? "s" : ""} found
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={manufacturer}
                onChange={(e) => updateParam("manufacturer", e.target.value)}
                className="border rounded-md px-2.5 py-2 text-sm bg-background"
              >
                <option value="">All manufacturers</option>
                {manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select
                value={orderBy}
                onChange={(e) => updateParam("orderBy", e.target.value)}
                className="border rounded-md px-2.5 py-2 text-sm bg-background"
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Results */}
          {isLoading ? (
            <PartGridSkeleton count={9} />
          ) : parts.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Search className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-lg font-medium">No parts found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                className="inline-flex items-center gap-1 px-4 py-2 border rounded-md text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => {
                      const p = new URLSearchParams(searchParams);
                      p.set("page", String(pageNum));
                      router.push(`/search?${p}`);
                    }}
                    className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                      page === pageNum ? "bg-primary text-white border-primary" : "hover:bg-accent"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  const p = new URLSearchParams(searchParams);
                  p.set("page", String(page + 1));
                  router.push(`/search?${p}`);
                }}
                className="inline-flex items-center gap-1 px-4 py-2 border rounded-md text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
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
