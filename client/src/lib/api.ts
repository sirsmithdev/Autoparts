/**
 * API client for the parts store.
 * Talks to the parts-store Express backend via /api/store/* endpoints.
 * In dev, Next.js rewrites proxy these to Express on port 5002.
 * In production, Express serves both API and pages (same origin, no proxy).
 */

const API_BASE = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "");

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== "undefined") {
    localStorage.setItem("ps_refresh_token", refresh);
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("ps_refresh_token");
  }
}

export function getAccessToken() { return accessToken; }

async function refreshAccessToken(): Promise<boolean> {
  const stored = refreshToken || (typeof window !== "undefined" ? localStorage.getItem("ps_refresh_token") : null);
  if (!stored) return false;
  try {
    const res = await fetch(`${API_BASE}/api/store/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: stored }),
    });
    if (!res.ok) { clearTokens(); return false; }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
