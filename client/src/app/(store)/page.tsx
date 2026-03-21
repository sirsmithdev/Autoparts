import { PartCard } from "@/components/PartCard";
import { HomeClient } from "./home-client";
import Link from "next/link";
import {
  Disc3, Cog, Zap, ArrowUpDown, Car, Thermometer,
  Settings2, Filter, Wind, Package, Truck, Shield, RotateCcw,
  Wrench, Star, Users, CheckCircle2,
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
      {/* Hero section - 2 column layout */}
      <section className="bg-[hsl(var(--header-bg))] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Left column - text + vehicle selector */}
            <div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
                Add Your Car. Find<br />Perfect Parts.
              </h1>
              <p className="text-base text-gray-400 mb-8 max-w-lg">
                Search by vehicle, part number, or VIN.
                Quality OEM and aftermarket parts with island-wide delivery.
              </p>
              <HomeClient />
            </div>

            {/* Right column - decorative */}
            <div className="hidden md:flex items-center justify-center">
              <div className="relative w-full max-w-sm">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/5 border border-white/10 flex items-center justify-center">
                  <Wrench className="h-32 w-32 text-blue-400/30" />
                </div>
                {/* Floating badges */}
                <div className="absolute -top-3 -right-3 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  5000+ Parts
                </div>
                <div className="absolute -bottom-3 -left-3 bg-white text-foreground text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  OEM & Aftermarket
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brand logos carousel */}
      <section className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between gap-8 overflow-x-auto scrollbar-hide">
            {["Toyota", "Honda", "Nissan", "Hyundai", "Suzuki", "Mitsubishi", "BMW", "Mercedes"].map((brand) => (
              <Link
                key={brand}
                href={`/search?q=${encodeURIComponent(brand)}`}
                className="text-sm font-semibold text-muted-foreground/60 hover:text-foreground transition-colors shrink-0 tracking-wider uppercase"
              >
                {brand}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Category icons - horizontal scroll */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide pb-2">
            {categories.map((cat) => {
              const Icon = categoryIcons[cat] || Package;
              return (
                <Link
                  key={cat}
                  href={`/search?category=${encodeURIComponent(cat)}`}
                  className="group flex flex-col items-center gap-2.5 shrink-0"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 group-hover:ring-2 group-hover:ring-primary/30 transition-all">
                    <Icon className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-xs font-medium text-center text-muted-foreground group-hover:text-foreground transition-colors">{cat}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured Parts - "Top Hot Right Now" */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Top Hot Right Now</h2>
            <Link href="/search" className="text-sm text-primary hover:underline font-medium">
              View All Parts &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map(part => <PartCard key={part.id} {...part} />)}
          </div>
        </section>
      )}

      {/* Promotional Banner */}
      <section className="bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-12 flex items-center justify-center">
              <Car className="h-28 w-28 text-primary/40" />
            </div>
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Quality Parts, Delivered</span>
              <h3 className="text-2xl md:text-3xl font-bold mt-2 mb-4">
                Everything your vehicle needs, all in one place.
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                From brake pads to engine components, we stock thousands of OEM and aftermarket parts
                for the most popular vehicle makes and models in Jamaica.
              </p>
              <Link
                href="/search"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Browse Our Catalog &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Package, value: "5,000+", label: "Parts Available" },
            { icon: Users, value: "500+", label: "Vehicles Supported" },
            { icon: RotateCcw, value: "30 Days", label: "Return Policy" },
            { icon: CheckCircle2, value: "100%", label: "Genuine Parts" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="text-center p-6 rounded-lg border bg-card hover:shadow-md transition-shadow">
              <Icon className="h-8 w-8 text-primary mx-auto mb-3" />
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
