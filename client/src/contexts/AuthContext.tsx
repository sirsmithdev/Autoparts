"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setTokens, clearTokens } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  garageLogin: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("ps_refresh_token");
    if (stored) {
      api<{ user: User; accessToken: string; refreshToken: string }>("/api/store/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: stored }),
      })
        .then((data) => {
          setTokens(data.accessToken, data.refreshToken);
          setUser(data.user);
        })
        .catch(() => {
          clearTokens();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User; accessToken: string; refreshToken: string }>(
      "/api/store/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const garageLogin = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User; accessToken: string; refreshToken: string }>(
      "/api/store/auth/316-login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const result = await api<{ user: User; accessToken: string; refreshToken: string }>(
      "/api/store/auth/register",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value: AuthState = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    garageLogin,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
