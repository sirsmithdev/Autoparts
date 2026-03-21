"use client";

import { useState, useEffect, useCallback } from "react";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

// Global event bus for toasts
const listeners = new Set<(toast: Toast) => void>();
const dismissListeners = new Set<(id: string) => void>();

function emitToast(toast: Toast) {
  listeners.forEach((fn) => fn(toast));
}

function emitDismiss(id: string) {
  dismissListeners.forEach((fn) => fn(id));
}

export function useToast() {
  const toast = useCallback(({ title, description, variant }: Omit<Toast, "id">) => {
    const t: Toast = { id: Date.now().toString(), title, description, variant };
    emitToast(t);
  }, []);

  return { toast };
}

/** Hook used by the Toaster component to consume toast events */
export function useToastState() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleToast = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    };
    const handleDismiss = (id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    };
    listeners.add(handleToast);
    dismissListeners.add(handleDismiss);
    return () => {
      listeners.delete(handleToast);
      dismissListeners.delete(handleDismiss);
    };
  }, []);

  const dismiss = useCallback((id: string) => emitDismiss(id), []);

  return { toasts, dismiss };
}
