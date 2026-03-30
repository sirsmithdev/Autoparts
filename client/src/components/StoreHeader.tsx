"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useCart";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ShoppingCart, User, LogOut, Search, Store,
  Package, RotateCcw, ChevronDown, Menu, X, Settings,
  Grid3X3, Tag, Flame, Heart,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeaderVehicleSelector } from "./HeaderVehicleSelector";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

function looksLikePartNumber(s: string): boolean {
  const t = s.trim();
  return t.length >= 3 && /^[A-Za-z0-9\-_]+$/.test(t) && !/\s/.test(t);
}

function looksLikeVin(s: string): boolean {
  const t = s.trim().toUpperCase();
  return t.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(t);
}

export function StoreHeader() {
  const { isAuthenticated, user, logout } = useAuth();
  const guestItemCount = useGuestCart((s) => s.guestItemCount);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const { data: cartData } = useQuery<{ itemCount?: number; items?: unknown[] }>({
    queryKey: ["server-cart"],
    queryFn: () => api("/api/store/cart"),
    enabled: isAuthenticated,
  });

  const cartCount = isAuthenticated ? (cartData?.itemCount ?? 0) : guestItemCount();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      if (looksLikeVin(q)) {
        const decoded = await api<{ make: string; model: string; year: string }>(
          `/api/store/catalog/decode-vin/${encodeURIComponent(q)}`
        );
        if (decoded?.make && decoded?.year) {
          router.push(
            `/search?make=${encodeURIComponent(decoded.make)}&model=${encodeURIComponent(decoded.model || decoded.make)}&year=${encodeURIComponent(decoded.year)}`
          );
          return;
        }
      }
      if (looksLikePartNumber(q)) {
        const part = await api<{ id: string }>(`/api/store/catalog/lookup/${encodeURIComponent(q)}`);
        if (part?.id) {
          router.push(`/parts/${part.id}`);
          return;
        }
      }
    } catch {
      // Fall through to text search
    } finally {
      setSearching(false);
    }
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* Main header bar — white background */}
      <div className="border-b border-[rgb(231,236,238)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-[76px]">
            {/* Mobile menu toggle */}
            <button
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 font-bold text-lg shrink-0">
              <div className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center">
                <Store className="h-5 w-5 text-white" />
              </div>
              <span className="hidden sm:inline text-foreground">316 Auto Parts</span>
              <span className="sm:hidden text-foreground">316</span>
            </Link>

            {/* My Garage - vehicle selector */}
            <div className="hidden md:block">
              <HeaderVehicleSelector />
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden sm:block">
              <div className="relative flex">
                <input
                  type="text"
                  placeholder="Search popular products..."
                  className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-300 rounded-l-md text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={searching}
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="px-4 bg-primary hover:bg-primary/90 rounded-r-md transition-colors flex items-center justify-center"
                >
                  <Search className="h-4 w-4 text-white" />
                </button>
              </div>
            </form>

            {/* Right nav icons */}
            <nav className="flex items-center gap-1 ml-auto">
              {/* User menu */}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex flex-col items-center gap-0.5 p-2 text-[rgb(49,67,80)] hover:text-foreground transition-colors rounded-md hover:bg-slate-100">
                    <User className="h-5 w-5" />
                    <span className="text-[11px] font-medium hidden lg:block">
                      {user?.firstName || "Account"}
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/account")}>
                      <Settings className="h-4 w-4 mr-2" /> Account
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/orders")}>
                      <Package className="h-4 w-4 mr-2" /> Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/wishlist")}>
                      <Heart className="h-4 w-4 mr-2" /> Wishlist
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/returns")}>
                      <RotateCcw className="h-4 w-4 mr-2" /> Returns
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="h-4 w-4 mr-2" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  href="/login"
                  className="flex flex-col items-center gap-0.5 p-2 text-[rgb(49,67,80)] hover:text-foreground transition-colors rounded-md hover:bg-slate-100"
                >
                  <User className="h-5 w-5" />
                  <span className="text-[11px] font-medium hidden lg:block">Sign In</span>
                </Link>
              )}

              {/* Wishlist */}
              {isAuthenticated && (
                <Link href="/wishlist" className="relative flex flex-col items-center gap-0.5 p-2 text-[rgb(49,67,80)] hover:text-foreground transition-colors rounded-md hover:bg-slate-100">
                  <Heart className="h-5 w-5" />
                  <span className="text-[11px] font-medium hidden lg:block">Wishlist</span>
                </Link>
              )}

              {/* Cart */}
              <Link href="/cart" className="relative flex flex-col items-center gap-0.5 p-2 text-[rgb(49,67,80)] hover:text-foreground transition-colors rounded-md hover:bg-slate-100">
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              </Link>
            </nav>
          </div>

          {/* Mobile search bar */}
          <form onSubmit={handleSearch} className="sm:hidden pb-3">
            <div className="relative flex">
              <input
                type="text"
                placeholder="Search products..."
                className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-300 rounded-l-md text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={searching}
              />
              <button
                type="submit"
                disabled={searching}
                className="px-4 bg-primary hover:bg-primary/90 rounded-r-md transition-colors flex items-center justify-center"
              >
                <Search className="h-4 w-4 text-white" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Category navigation bar — light blue-gray background */}
      <div className="bg-[rgb(239,244,247)] border-b border-[rgb(222,230,235)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide py-0">
            {/* All Categories button */}
            <Link
              href="/search"
              className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-[15px] text-black font-semibold hover:text-primary rounded-sm transition-colors"
            >
              <Grid3X3 className="h-4 w-4" />
              All Categories
            </Link>

            <span className="w-px h-5 bg-slate-300 shrink-0 mx-1" />

            <Link href="/" className="shrink-0 px-3 py-2.5 text-[15px] text-black font-semibold hover:text-primary rounded-sm transition-colors">
              Home
            </Link>
            <Link href="/search" className="shrink-0 px-3 py-2.5 text-[15px] text-black font-semibold hover:text-primary rounded-sm transition-colors">
              Shop
            </Link>
            <Link href="/search?category=Brakes" className="shrink-0 px-3 py-2.5 text-[15px] text-black font-semibold hover:text-primary rounded-sm transition-colors">
              Brakes
            </Link>
            <Link href="/search?category=Electrical" className="shrink-0 px-3 py-2.5 text-[15px] text-black font-semibold hover:text-primary rounded-sm transition-colors">
              Electrical
            </Link>
            <Link href="/search?category=Engine" className="shrink-0 px-3 py-2.5 text-[15px] text-black font-semibold hover:text-primary rounded-sm transition-colors">
              Engine
            </Link>
            <Link href="/diagrams" className="shrink-0 px-3 py-2.5 text-[15px] text-black font-semibold hover:text-primary rounded-sm transition-colors">
              Parts Diagrams
            </Link>
            <Link href="/contact" className="shrink-0 px-3 py-2.5 text-[15px] text-black font-semibold hover:text-primary rounded-sm transition-colors">
              Contact
            </Link>

            <span className="flex-1" />

            {/* Right badges */}
            <Link
              href="/search?orderBy=popular"
              className="shrink-0 flex items-center gap-1 px-3 py-2.5 text-[15px] text-black font-semibold hover:text-primary transition-colors"
            >
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              Best Seller
            </Link>
            <Link
              href="/search?condition=used"
              className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-white bg-red-500 rounded-sm transition-colors hover:bg-red-600"
            >
              <Tag className="h-3 w-3" />
              SALE
            </Link>
          </nav>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 top-[76px]">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative bg-white border-b p-4 space-y-3 max-h-[70vh] overflow-y-auto shadow-lg">
            <div className="md:hidden">
              <HeaderVehicleSelector />
            </div>

            <div className="space-y-1 pt-2 border-t">
              {["Brakes", "Engine", "Electrical", "Suspension", "Body", "Cooling", "Transmission", "Filters", "Exhaust"].map((cat) => (
                <Link
                  key={cat}
                  href={`/search?category=${encodeURIComponent(cat)}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-foreground rounded-md hover:bg-slate-100"
                >
                  {cat}
                </Link>
              ))}
            </div>

            {isAuthenticated && (
              <div className="space-y-1 pt-2 border-t">
                <Link href="/orders" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-foreground rounded-md hover:bg-slate-100">
                  <Package className="h-4 w-4" /> My Orders
                </Link>
                <Link href="/returns" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-foreground rounded-md hover:bg-slate-100">
                  <RotateCcw className="h-4 w-4" /> Returns
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
