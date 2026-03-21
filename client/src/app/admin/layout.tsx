"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import {
  Package, RotateCcw, Settings, LogOut, ShoppingBag,
  ChevronLeft, LayoutDashboard, User, Warehouse, ClipboardList,
} from "lucide-react";

const STAFF_ROLES = ["admin", "manager", "receptionist"];

const adminNav = [
  { label: "Orders", href: "/admin/orders", icon: Package },
  { label: "Pick Lists", href: "/admin/pick-lists", icon: ClipboardList },
  { label: "Returns", href: "/admin/returns", icon: RotateCcw },
  { label: "Warehouse", href: "/admin/warehouse", icon: Warehouse },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Don't protect the admin login page
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
    if (!isLoading && (!isAuthenticated || !STAFF_ROLES.includes(user?.role || ""))) {
      router.replace("/admin/login");
    }
  }, [isLoading, isAuthenticated, user, router, isLoginPage]);

  // Admin login page renders without the sidebar
  if (isLoginPage) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !STAFF_ROLES.includes(user?.role || "")) return null;

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-60 bg-[hsl(var(--header-bg))] text-white flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">316 Parts Store</p>
              <p className="text-xs text-gray-400">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {adminNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Back to Store */}
        <div className="p-3 border-t border-white/10">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Store
          </Link>
        </div>

        {/* User */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <User className="h-4 w-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.firstName || user?.email?.split("@")[0]}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={() => { logout(); router.replace("/admin/login"); }}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-card border-b px-6 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-medium text-muted-foreground">
            {adminNav.find(n => pathname.startsWith(n.href))?.label || "Admin"}
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Parts Store Management
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
