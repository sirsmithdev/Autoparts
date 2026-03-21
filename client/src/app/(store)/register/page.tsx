"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { mergeGuestCartToServer } from "@/hooks/useCart";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Loader2, Lock, Mail, User, Phone } from "lucide-react";

function RegisterForm() {
  const { register, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isAuthenticated) router.replace(redirect); }, [isAuthenticated, redirect, router]);
  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({ email, password, firstName, lastName, phone: phone || undefined });
      await mergeGuestCartToServer();
      router.replace(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / Brand */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-xl bg-[hsl(222,47%,11%)] flex items-center justify-center">
            <span className="text-white text-xl font-bold">316</span>
          </div>
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-sm text-muted-foreground">Sign up to see prices and place orders</p>
        </div>

        <div className="border rounded-xl bg-card p-6 shadow-sm space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <Lock className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="John"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Last Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Doe"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  className="w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={8}
                  className="w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">
                Phone <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="tel"
                  className="w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="876-555-1234"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</> : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
