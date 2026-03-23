"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { mergeGuestCartToServer } from "@/hooks/useCart";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Loader2, Lock, Eye, EyeOff, Wrench } from "lucide-react";

function RegisterForm() {
  const { register, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
      <div className="w-full max-w-md space-y-6">
        {/* Login / Register tabs */}
        <div className="flex gap-6 border-b">
          <Link
            href="/login"
            className="pb-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Login
          </Link>
          <span className="pb-2.5 text-sm font-medium text-primary border-b-2 border-primary">
            Register
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          There are many advantages to creating an account: the payment process is faster, shipment tracking is possible and much more.
        </p>

        <Link
          href="/login"
          onClick={(e) => { e.preventDefault(); window.location.href = "/login"; }}
          className="flex items-center gap-3 p-3 border-2 border-primary/20 rounded-md text-sm font-medium hover:bg-primary/5 transition-colors"
        >
          <Wrench className="h-5 w-5 text-primary shrink-0" />
          <span>Already have a 316 Automotive account? <span className="text-primary">Sign in instead</span></span>
        </Link>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <Lock className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Email address *</label>
            <input
              type="email"
              required
              className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Password *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                className="w-full border rounded-md px-3 pr-10 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">First Name *</label>
            <input
              type="text"
              required
              className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Last Name *</label>
            <input
              type="text"
              required
              className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Phone <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="tel"
              className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Your personal data will be used to support your experience throughout this website, to manage access to your account, and for other purposes described in our{" "}
            <Link href="#" className="text-primary hover:underline">privacy policy</Link>.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground rounded-md font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</> : "Register"}
          </button>
        </form>
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
