import { PartCard } from "@/components/PartCard";
import { HomeClient } from "./home-client";
import Link from "next/link";
import {
  Disc3, Cog, Zap, ArrowUpDown, Car, Thermometer,
  Settings2, Filter, Wind, Package, Truck, Shield, RotateCcw,
  Star, Users, CheckCircle2, Phone, Headphones, ChevronRight,
  Lightbulb, Gauge, Wrench, Clock,
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

const categoryImages: Record<string, string> = {
  Brakes: "🔧", Engine: "⚙️", Electrical: "⚡", Suspension: "🔩",
  Body: "🚗", Cooling: "❄️", Transmission: "⚙️", Filters: "🔍", Exhaust: "💨",
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
      {/* ═══ HERO SECTION ═══ */}
      <section className="bg-white border-b relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-6 items-center min-h-[420px] py-10 md:py-0">
            {/* Left - text + vehicle selector */}
            <div className="relative z-10">
              <h1 className="text-3xl md:text-4xl lg:text-[42px] font-bold text-foreground mb-3 leading-tight tracking-tight">
                Add Your Car. Find<br />Perfect Parts.
              </h1>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Having the right automotive parts and car accessories will help you to boost your travel comfort and go on the long-distance journey comfortably.
              </p>
              <HomeClient />
            </div>
            {/* Right - product image placeholder */}
            <div className="hidden md:flex items-center justify-end relative">
              <div className="relative">
                <div className="w-72 h-80 bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl flex items-center justify-center">
                  <Wrench className="h-36 w-36 text-gray-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BRAND LOGO STRIP ═══ */}
      <section className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-10 overflow-x-auto scrollbar-hide">
            {["Toyota", "Honda", "Nissan", "Hyundai", "Suzuki", "Mitsubishi", "BMW", "Mercedes", "Kia", "Subaru"].map((brand) => (
              <Link
                key={brand}
                href={`/search?q=${encodeURIComponent(brand)}`}
                className="text-sm font-bold text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 tracking-widest uppercase"
              >
                {brand}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURE ICONS BAR ═══ */}
      <section className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
            {[
              { icon: Truck, label: "Free Shipping", sub: "On orders over $15,000" },
              { icon: RotateCcw, label: "Easy Returns", sub: "30-day return policy" },
              { icon: Shield, label: "Warranty", sub: "Quality guaranteed" },
              { icon: Headphones, label: "Customer Support", sub: "Mon-Sat 8am-5pm" },
              { icon: CheckCircle2, label: "Genuine Parts", sub: "OEM & aftermarket" },
              { icon: Clock, label: "Fast Delivery", sub: "Island-wide" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CATEGORY CARDS ═══ */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.slice(0, 12).map((cat) => {
              const Icon = categoryIcons[cat] || Package;
              return (
                <Link
                  key={cat}
                  href={`/search?category=${encodeURIComponent(cat)}`}
                  className="group relative flex flex-col items-center p-5 bg-card border rounded-md hover:shadow-lg hover:border-primary/30 transition-all overflow-hidden"
                >
                  <div className="w-24 h-20 flex items-center justify-center mb-3">
                    <Icon className="h-12 w-12 text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
                  </div>
                  <span className="text-sm font-semibold text-center">{cat}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ SECTION DIVIDER ═══ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="border-t" />
      </div>

      {/* ═══ "TOP HOT RIGHT NOW" PRODUCTS ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Our most ordered products.</p>
            <h2 className="text-2xl font-bold">Top Hot Right Now</h2>
          </div>
          <Link href="/search" className="text-sm text-primary hover:underline font-medium flex items-center gap-1">
            View All <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
            {featured.slice(0, 8).map(part => <PartCard key={part.id} {...part} />)}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm">Products coming soon. Check back shortly.</p>
          </div>
        )}
      </section>

      {/* ═══ "FIND THE RIGHT PARTS FASTER" ═══ */}
      <section className="bg-muted/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">Find the Right Parts Faster</h2>
            <p className="text-sm text-muted-foreground mt-2">
              You can find the product you are looking for faster by entering the search criteria correctly.
            </p>
          </div>
          <div className="max-w-4xl mx-auto bg-white rounded-lg border p-6 shadow-sm">
            <HomeClient variant="inline" />
          </div>
        </div>
      </section>

      {/* ═══ REVIEWS SECTION ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-12">
          {/* Rating summary */}
          <div className="shrink-0">
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className="h-5 w-5 fill-rating text-rating" />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Based on 2,147 reviews</p>
            <p className="text-xs text-muted-foreground mt-1">All comments are from real users who<br />have made purchases before.</p>
            <p className="text-xs font-medium text-primary mt-2">Showing our 5 star reviews.</p>
          </div>
          {/* Review cards */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "Michael R.", text: "Great quality brake pads. Exact fit for my Corolla. Fast shipping too!" },
              { name: "Sandra K.", text: "Found the exact headlight assembly I needed. Price was much better than the dealer." },
              { name: "David M.", text: "Excellent customer service. They helped me find the right part number over the phone." },
              { name: "Lisa T.", text: "Quick delivery and the oil filter was genuine OEM. Will order again!" },
            ].map(review => (
              <div key={review.name} className="border rounded-md p-4 bg-card">
                <div className="flex items-center gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className="h-3 w-3 fill-rating text-rating" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">{review.text}</p>
                <p className="text-xs font-semibold">{review.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TWO PROMO BANNERS ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="grid md:grid-cols-2 gap-5">
          <div className="relative rounded-md overflow-hidden bg-gradient-to-r from-blue-900 to-blue-800 p-8 text-white min-h-[200px] flex flex-col justify-center">
            <p className="text-xs uppercase tracking-wider text-blue-300 mb-2">Best Quality Products</p>
            <h3 className="text-2xl font-bold leading-tight mb-2">High<br />Performance.</h3>
            <p className="text-xs text-blue-200 mb-4">Premium parts for peak vehicle performance.</p>
            <Link href="/search?condition=new" className="inline-flex items-center gap-1 text-xs font-semibold text-white hover:underline">
              Shop Now <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="relative rounded-md overflow-hidden bg-gradient-to-r from-gray-800 to-gray-700 p-8 text-white min-h-[200px] flex flex-col justify-center">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Competitive Pricing</p>
            <h3 className="text-2xl font-bold leading-tight mb-2">Best<br />Aftermarket Price.</h3>
            <p className="text-xs text-gray-300 mb-4">Quality aftermarket alternatives at great prices.</p>
            <Link href="/search" className="inline-flex items-center gap-1 text-xs font-semibold text-white hover:underline">
              Shop Now <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ CONTENT SECTION - WHY CHOOSE US ═══ */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Why Choose Us</span>
              <h2 className="text-2xl md:text-3xl font-bold mt-2 mb-4 leading-tight">
                Quality parts you can<br />trust for every vehicle.
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                We source our parts from trusted manufacturers and distributors, ensuring every component meets strict quality standards. Whether you need OEM replacements or aftermarket upgrades, we have you covered.
              </p>
              <div className="space-y-4">
                {[
                  { icon: CheckCircle2, title: "Verified OEM Parts", desc: "Every OEM part is verified for authenticity and compatibility with your vehicle." },
                  { icon: Truck, title: "Island-Wide Delivery", desc: "We deliver to every parish in Jamaica. Free shipping on orders over $15,000." },
                  { icon: RotateCcw, title: "30-Day Easy Returns", desc: "Not the right fit? Return any unused part within 30 days for a full refund." },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/search" className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-primary hover:underline">
                Read and Shop Now <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg p-10 flex items-center justify-center min-h-[350px]">
              <Car className="h-40 w-40 text-gray-200" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PROMO BANNER ═══ */}
      <section className="bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Truck className="h-8 w-8 text-white" />
              <div>
                <p className="text-sm font-semibold text-white">Free Island-Wide Delivery</p>
                <p className="text-xs text-white/70">On orders over $15,000 JMD.</p>
              </div>
            </div>
            <Link href="/search" className="px-5 py-2.5 bg-white/15 border border-white/30 rounded-md text-sm font-semibold text-white hover:bg-white/25 transition-colors">
              Shop Now
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ SECOND PRODUCTS SECTION ═══ */}
      {featured.length > 8 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Recently Added</h2>
            <Link href="/search?orderBy=newest" className="text-sm text-primary hover:underline font-medium flex items-center gap-1">
              View All <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.slice(8, 16).map(part => <PartCard key={`recent-${part.id}`} {...part} />)}
          </div>
        </section>
      )}

      {/* ═══ CTA - CALL US ═══ */}
      <section className="bg-[hsl(var(--header-bg))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">Our Parts Experts Can Help.</h3>
              <p className="text-sm text-gray-400">Call for immediate assistance. You can contact us Mon-Sat.</p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="tel:+18765550316"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Phone className="h-4 w-4" />
                Request a Call
              </a>
              <span className="text-lg font-bold text-white hidden md:inline">(876) 555-0316</span>
            </div>
            <p className="text-xs text-gray-500 md:hidden">Mon-Sat 8am-5pm.</p>
          </div>
        </div>
      </section>

      {/* ═══ BRAND LOGOS GRID ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Our most ordered products.</p>
            <h2 className="text-2xl font-bold">Shop by Brand</h2>
          </div>
          <Link href="/search" className="text-sm text-primary hover:underline font-medium flex items-center gap-1">
            View All <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Toyota", "Honda", "Nissan", "Hyundai"].map((brand) => (
            <Link
              key={brand}
              href={`/search?q=${encodeURIComponent(brand)}`}
              className="flex items-center gap-4 p-5 border rounded-md bg-card hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center shrink-0">
                <Car className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-semibold">{brand}</p>
                <p className="text-xs text-muted-foreground">Genuine & aftermarket parts</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══ FAQ + IMAGE SECTION ═══ */}
      <section className="bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            {/* Image */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-10 flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden">
              <Wrench className="h-32 w-32 text-primary/20" />
              <div className="mt-6 text-center">
                <h3 className="text-xl font-bold">Something you might<br />be curious about.</h3>
                <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                  Find answers to common questions about our parts, shipping, and returns.
                </p>
                <Link href="/search" className="inline-flex items-center gap-2 mt-4 px-5 py-2 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors">
                  Shop Now
                </Link>
              </div>
            </div>

            {/* FAQ Accordion */}
            <div>
              <h2 className="text-xl font-bold mb-4">Frequently Asked Questions</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Everything you need to know about ordering parts from 316 Auto Parts.
              </p>
              <div className="space-y-3">
                {[
                  { q: "How do I know if a part fits my vehicle?", a: "Use our vehicle selector at the top of any page to enter your make, model, and year. Products will show a 'Fits' badge if they're compatible." },
                  { q: "What is your return policy?", a: "We offer a 30-day return policy on all unused parts in original packaging. Contact us to initiate a return." },
                  { q: "Do you offer island-wide delivery?", a: "Yes! We deliver to every parish in Jamaica. Delivery fees vary by zone and are calculated at checkout." },
                  { q: "Are your parts genuine OEM?", a: "We carry both genuine OEM parts and quality aftermarket alternatives. Each listing clearly indicates the part type and manufacturer." },
                  { q: "How long does delivery take?", a: "Delivery typically takes 1-3 business days depending on your location. You'll receive tracking information via email." },
                ].map(({ q, a }) => (
                  <details key={q} className="group border rounded-md bg-card overflow-hidden">
                    <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer text-sm font-medium hover:bg-accent/50 transition-colors">
                      {q}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-open:rotate-90 transition-transform" />
                    </summary>
                    <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TRUST STATS BAR ═══ */}
      <section className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Package, value: "5,000+", label: "Parts Available" },
              { icon: Users, value: "500+", label: "Vehicles Supported" },
              { icon: RotateCcw, value: "30 Days", label: "Return Policy" },
              { icon: CheckCircle2, value: "100%", label: "Genuine Parts" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="text-center">
                <Icon className="h-7 w-7 text-primary mx-auto mb-2" />
                <div className="text-xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
