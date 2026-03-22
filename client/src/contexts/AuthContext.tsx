"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setTokens, clearTokens } from "@/lib/api";
import { hasPermission as checkPermission, type Permission } from "@/lib/permissions";

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string | null;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface AuthResponse {
  customer: User;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  garageLogin: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("ps_refresh_token");
    if (stored) {
      api<AuthResponse>("/api/store/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: stored }),
      })
        .then((data) => {
          setTokens(data.accessToken, data.refreshToken);
          setUser(data.customer);
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
    const data = await api<AuthResponse>(
      "/api/store/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.customer);
  }, []);

  const garageLogin = useCallback(async (email: string, password: string) => {
    const data = await api<AuthResponse>(
      "/api/store/auth/316-login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.customer);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const result = await api<AuthResponse>(
      "/api/store/auth/register",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    setTokens(result.accessToken, result.refreshToken);
    setUser(result.customer);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const hasPermissionFn = useCallback((permission: Permission) => {
    return checkPermission(user?.role, permission);
  }, [user?.role]);

  const value: AuthState = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    garageLogin,
    register,
    logout,
    hasPermission: hasPermissionFn,
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
