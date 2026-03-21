"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

const STAFF_ROLES = ["admin", "manager", "receptionist"];

export default function AdminLoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in as staff — redirect
  useEffect(() => {
    if (isAuthenticated && user && STAFF_ROLES.includes(user.role)) {
      router.replace("/admin/orders");
    }
  }, [isAuthenticated, user, router]);

  if (isAuthenticated && user && STAFF_ROLES.includes(user.role)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // After login, check role. The auth context will update, then the admin layout will handle the redirect.
      router.replace("/admin/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--header-bg))] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-md bg-white/10 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">316</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Parts Store Admin</h1>
            <p className="text-sm text-gray-400 mt-1">Sign in with your staff credentials</p>
          </div>
        </div>

        <div className="border border-white/10 rounded-md bg-white/5 backdrop-blur-sm p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-sm">
              <Lock className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="email"
                  required
                  className="w-full border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm bg-white/5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="staff@316-automotive.com"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="password"
                  required
                  className="w-full border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm bg-white/5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Staff-only access. Use your 316 Automotive account.
        </p>
      </div>
    </div>
  );
}
