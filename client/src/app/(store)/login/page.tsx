"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { mergeGuestCartToServer } from "@/hooks/useCart";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Loader2, Lock, Eye, EyeOff, Wrench } from "lucide-react";
import { api, setTokens } from "@/lib/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (callback?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
        };
      };
    };
  }
}

function LoginForm() {
  const { login, garageLogin, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mode, setMode] = useState<"store" | "316">("store");
  const gsiScriptLoaded = useRef(false);

  // Load Google Identity Services script and initialize
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || gsiScriptLoaded.current) return;
    gsiScriptLoaded.current = true;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || !window.google) {
      setError("Google Sign-In is not available");
      return;
    }

    setError("");
    setGoogleLoading(true);

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) {
            setGoogleLoading(false);
            setError("Google Sign-In failed — no credential received");
            return;
          }
          try {
            const data = await api<{ customer: { id: string; email: string; firstName: string | null; lastName: string | null; phone: string | null; role: string | null }; accessToken: string; refreshToken: string }>(
              "/api/store/auth/google",
              {
                method: "POST",
                body: JSON.stringify({ idToken: response.credential }),
              },
            );
            setTokens(data.accessToken, data.refreshToken);
            // Reload auth state by storing tokens then navigating
            await mergeGuestCartToServer();
            window.location.href = redirect;
          } catch (err) {
            setError(err instanceof Error ? err.message : "Google Sign-In failed");
          } finally {
            setGoogleLoading(false);
          }
        },
      });
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setGoogleLoading(false);
          setError("Google Sign-In popup was blocked or dismissed. Please allow popups and try again.");
        }
      });
    } catch (err) {
      setGoogleLoading(false);
      setError(err instanceof Error ? err.message : "Google Sign-In failed");
    }
  }, [redirect]);

  useEffect(() => { if (isAuthenticated) router.replace(redirect); }, [isAuthenticated, redirect, router]);
  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "316") {
        await garageLogin(email, password);
      } else {
        await login(email, password);
      }
      await mergeGuestCartToServer();
      router.replace(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold">Log in</h1>

        {/* Social / external login buttons */}
        {mode === "store" && (
          <>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { setMode("316"); setError(""); }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-primary/20 rounded-md text-sm font-medium hover:bg-primary/5 transition-colors"
              >
                <Wrench className="h-5 w-5 text-primary" />
                Sign in with 316 Automotive account
              </button>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border rounded-md text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                )}
                Continue with Google
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
            </div>
          </>
        )}

        {/* 316 mode header */}
        {mode === "316" && (
          <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
            <Wrench className="h-5 w-5 text-primary shrink-0" />
            <div className="text-sm">
              <p className="font-medium">316 Automotive Account</p>
              <p className="text-muted-foreground">Use your existing 316 garage login</p>
            </div>
          </div>
        )}

        {/* Email/password form */}
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              <Lock className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Email</label>
              <input
                type="email"
                required
                className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email address"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full border rounded-md px-3 pr-10 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
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

            {mode === "store" && (
              <div className="flex items-center justify-between text-sm">
                <div />
                <Link href="/forgot-password" className="text-primary hover:underline text-sm">
                  Forgot your password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-primary-foreground rounded-md font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
              ) : mode === "316" ? (
                "Sign in with 316 account"
              ) : (
                "Log in"
              )}
            </button>
          </form>

          {mode === "316" && (
            <button
              type="button"
              onClick={() => { setMode("store"); setError(""); }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to parts store login
            </button>
          )}

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            By continuing with Google or email, you agree to 316 Automotive&apos;s{" "}
            <Link href="#" className="text-primary hover:underline">Terms of Service</Link> and{" "}
            <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>.
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
