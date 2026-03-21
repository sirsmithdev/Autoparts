"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useCart";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ShoppingCart, User, LogOut, Search, Store,
  Package, RotateCcw, ChevronDown, Menu, X, Settings,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
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

const NAV_CATEGORIES = [
  "Brakes", "Engine", "Electrical", "Suspension", "Body",
  "Cooling", "Transmission", "Filters", "Exhaust",
];

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
    <header className="sticky top-0 z-50">
      {/* Main dark header bar */}
      <div className="bg-[hsl(222,47%,11%)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            {/* Mobile menu toggle */}
            <button
              className="lg:hidden p-2 -ml-2 text-gray-300 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
              <Store className="h-6 w-6 text-blue-400" />
              <span className="hidden sm:inline">316 Auto Parts</span>
              <span className="sm:hidden">316</span>
            </Link>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search parts by name, number, or VIN..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-full text-sm text-white placeholder:text-gray-400 focus:outline-none focus:bg-white/15 focus:border-blue-400 transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={searching}
                />
                {searching && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    Searching...
                  </span>
                )}
              </div>
            </form>

            {/* Vehicle selector */}
            <div className="hidden md:block">
              <HeaderVehicleSelector />
            </div>

            {/* Right nav */}
            <nav className="flex items-center gap-1">
              {/* Cart */}
              <Link href="/cart" className="relative p-2 text-gray-300 hover:text-white transition-colors rounded-md hover:bg-white/10">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center ring-2 ring-[hsl(222,47%,11%)]">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>

              {/* User menu */}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-1.5 px-2 py-2 text-sm text-gray-300 hover:text-white transition-colors rounded-md hover:bg-white/10">
                    <User className="h-4 w-4" />
                    <span className="hidden lg:inline max-w-[100px] truncate">
                      {user?.firstName || "Account"}
                    </span>
                    <ChevronDown className="h-3 w-3 hidden lg:block" />
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
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors rounded-md hover:bg-white/10"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* Category navigation bar */}
      <div className="bg-[hsl(217,33%,17%)] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-0">
            <Link
              href="/search"
              className="shrink-0 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
            >
              All Parts
            </Link>
            <Link
              href="/diagrams"
              className="shrink-0 px-3 py-2.5 text-sm text-yellow-300 hover:text-yellow-100 hover:bg-white/10 rounded-sm transition-colors font-medium"
            >
              OEM Diagrams
            </Link>
            {NAV_CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/search?category=${encodeURIComponent(cat)}`}
                className="shrink-0 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
              >
                {cat}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 top-16">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative bg-[hsl(222,47%,11%)] border-b border-white/10 p-4 space-y-3">
            <div className="md:hidden">
              <HeaderVehicleSelector />
            </div>
            {isAuthenticated && (
              <div className="space-y-1 pt-2 border-t border-white/10">
                <Link href="/orders" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white rounded-md hover:bg-white/10">
                  <Package className="h-4 w-4" /> My Orders
                </Link>
                <Link href="/returns" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white rounded-md hover:bg-white/10">
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
