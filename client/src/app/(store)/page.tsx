import { PartCard } from "@/components/PartCard";
import { HomeClient } from "./home-client";
import Link from "next/link";
import {
  Disc3, Cog, Zap, ArrowUpDown, Car, Thermometer,
  Settings2, Filter, Wind, Package, Truck, Shield, RotateCcw,
} from "lucide-react";

interface CatalogPart {
  id: string; name: string; partNumber: string; salePrice: string;
  category?: string | null; manufacturer?: string | null; imageUrl?: string | null; stockStatus: string; condition?: string;
}

const categoryIcons: Record<string, React.ElementType> = {
  Brakes: Disc3, Engine: Cog, Electrical: Zap, Suspension: ArrowUpDown,
  Body: Car, Cooling: Thermometer, Transmission: Settings2,
  Filters: Filter, Exhaust: Wind,
};

async function getFeaturedParts(): Promise<CatalogPart[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";
    const res = await fetch(`${apiUrl}/api/store/catalog/featured`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function getCategories(): Promise<string[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";
    const res = await fetch(`${apiUrl}/api/store/categories`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function HomePage() {
  const [featuredRaw, categoriesRaw] = await Promise.all([getFeaturedParts(), getCategories()]);
  const featured = Array.isArray(featuredRaw) ? featuredRaw : [];
  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : [];

  return (
    <div>
      {/* Hero section - full width dark */}
      <section className="bg-[hsl(222,47%,11%)] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Find the Right Part for Your Vehicle
          </h1>
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
            Search by part number, VIN, or vehicle make and model.
            Quality OEM and aftermarket parts with island-wide delivery.
          </p>
          <HomeClient />

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-8 mt-12 text-gray-400">
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-5 w-5 text-blue-400" />
              <span>Island-Wide Delivery</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-5 w-5 text-blue-400" />
              <span>Quality OEM Parts</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <RotateCcw className="h-5 w-5 text-blue-400" />
              <span>30-Day Returns</span>
            </div>
          </div>
        </div>
      </section>

      {/* Category cards */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold mb-6">Shop by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {categories.map((cat) => {
              const Icon = categoryIcons[cat] || Package;
              return (
                <Link
                  key={cat}
                  href={`/search?category=${encodeURIComponent(cat)}`}
                  className="group flex flex-col items-center gap-3 p-5 border rounded-xl bg-card hover:shadow-md hover:border-primary/30 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-center">{cat}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured Parts */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Featured Parts</h2>
            <Link href="/search" className="text-sm text-primary hover:underline font-medium">
              View All Parts
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map(part => <PartCard key={part.id} {...part} />)}
          </div>
        </section>
      )}
    </div>
  );
}
