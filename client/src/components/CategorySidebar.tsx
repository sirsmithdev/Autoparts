"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Disc3, Cog, Zap, ArrowUpDown, Car, Thermometer,
  Settings2, Filter as FilterIcon, Package, Wind, Gauge,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const categoryIcons: Record<string, LucideIcon> = {
  Brakes: Disc3, Engine: Cog, Electrical: Zap, Suspension: ArrowUpDown,
  Body: Car, Cooling: Thermometer, Transmission: Settings2,
  Filters: FilterIcon, Exhaust: Wind, Gauges: Gauge,
};

interface CategorySidebarProps {
  categories: string[];
  className?: string;
}

export function CategorySidebar({ categories, className = "" }: CategorySidebarProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentCategory = searchParams.get("category") || "";
  const baseParams = new URLSearchParams(searchParams);
  baseParams.delete("category");
  baseParams.delete("page");
  const allPartsHref = baseParams.toString() ? `/search?${baseParams}` : "/search";

  const updateParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete("page");
    router.push(`/search?${p}`);
  };

  if (categories.length === 0) return null;

  return (
    <aside className={cn("w-60 shrink-0 space-y-6", className)}>
      {/* Product Categories */}
      <div>
        <h3 className="font-bold text-sm mb-3 pb-2 border-b border-border text-foreground uppercase tracking-wider">
          Product Categories
        </h3>
        <ul className="space-y-1">
          <li>
            <Link
              href={allPartsHref}
              className={cn(
                "flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors",
                !currentCategory
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input type="checkbox" checked={!currentCategory} readOnly className="rounded border-gray-300 text-primary" />
              All Parts
            </Link>
          </li>
          {categories.map((cat) => {
            const isActive = currentCategory === cat;
            return (
              <li key={cat}>
                <Link
                  href={`/search?${new URLSearchParams({ ...Object.fromEntries(searchParams), category: cat, page: "1" })}`}
                  className={cn(
                    "flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors",
                    isActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <input type="checkbox" checked={isActive} readOnly className="rounded border-gray-300 text-primary" />
                  {cat}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="font-bold text-sm mb-3 pb-2 border-b border-border text-foreground uppercase tracking-wider">
          Price Range
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            className="w-full border rounded-md px-2.5 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            min={0}
            onChange={(e) => updateParam("minPrice", e.target.value)}
            defaultValue={searchParams.get("minPrice") || ""}
          />
          <span className="text-muted-foreground text-sm">–</span>
          <input
            type="number"
            placeholder="Max"
            className="w-full border rounded-md px-2.5 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            min={0}
            onChange={(e) => updateParam("maxPrice", e.target.value)}
            defaultValue={searchParams.get("maxPrice") || ""}
          />
        </div>
      </div>

      {/* Product Status */}
      <div>
        <h3 className="font-bold text-sm mb-3 pb-2 border-b border-border text-foreground uppercase tracking-wider">
          Product Status
        </h3>
        <div className="space-y-2">
          {["new", "refurbished", "used"].map((cond) => (
            <label key={cond} className="flex items-center gap-2.5 text-sm cursor-pointer text-muted-foreground hover:text-foreground">
              <input
                type="radio"
                name="condition"
                value={cond}
                checked={searchParams.get("condition") === cond}
                onChange={() => updateParam("condition", cond)}
                className="rounded-full border-gray-300"
              />
              <span className="capitalize">{cond}</span>
            </label>
          ))}
          <label className="flex items-center gap-2.5 text-sm cursor-pointer text-muted-foreground hover:text-foreground">
            <input
              type="radio"
              name="condition"
              value=""
              checked={!searchParams.get("condition")}
              onChange={() => updateParam("condition", "")}
              className="rounded-full border-gray-300"
            />
            All Conditions
          </label>
        </div>
      </div>

      {/* In Stock Filter */}
      <div>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={searchParams.get("inStockOnly") === "true"}
            onChange={(e) => updateParam("inStockOnly", e.target.checked ? "true" : "")}
            className="rounded border-gray-300"
          />
          <span className="font-medium">In Stock Only</span>
        </label>
      </div>
    </aside>
  );
}
