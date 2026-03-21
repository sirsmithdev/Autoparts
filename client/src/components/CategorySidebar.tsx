"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Disc3, Cog, Zap, ArrowUpDown, Car, Thermometer,
  Settings2, Filter as FilterIcon, Package, Wind, Gauge,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const categoryIcons: Record<string, LucideIcon> = {
  Brakes: Disc3,
  Engine: Cog,
  Electrical: Zap,
  Suspension: ArrowUpDown,
  Body: Car,
  Cooling: Thermometer,
  Transmission: Settings2,
  Filters: FilterIcon,
  Exhaust: Wind,
  Gauges: Gauge,
};

interface CategorySidebarProps {
  categories: string[];
  className?: string;
}

export function CategorySidebar({ categories, className = "" }: CategorySidebarProps) {
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") || "";
  const baseParams = new URLSearchParams(searchParams);
  baseParams.delete("category");
  baseParams.delete("page");
  const allPartsHref = baseParams.toString() ? `/search?${baseParams}` : "/search";

  if (categories.length === 0) return null;

  return (
    <aside className={cn("w-56 shrink-0", className)}>
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-foreground">
        <FilterIcon className="h-4 w-4" />
        Categories
      </h3>
      <ul className="space-y-0.5">
        <li>
          <Link
            href={allPartsHref}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
              !currentCategory
                ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Package className="h-4 w-4 shrink-0" />
            All Parts
          </Link>
        </li>
        {categories.map((cat) => {
          const Icon = categoryIcons[cat] || Package;
          const isActive = currentCategory === cat;
          return (
            <li key={cat}>
              <Link
                href={`/search?${new URLSearchParams({ ...Object.fromEntries(searchParams), category: cat, page: "1" })}`}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {cat}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
