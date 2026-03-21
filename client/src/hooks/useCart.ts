"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, getAccessToken } from "@/lib/api";

interface GuestCartItem {
  partId: string;
  quantity: number;
  name: string;
  partNumber: string;
  salePrice: string;
  imageUrl?: string | null;
}

interface CartStore {
  guestItems: GuestCartItem[];
  addGuestItem: (item: GuestCartItem) => void;
  removeGuestItem: (partId: string) => void;
  updateGuestQuantity: (partId: string, quantity: number) => void;
  clearGuest: () => void;
  guestItemCount: () => number;
}

export const useGuestCart = create<CartStore>()(
  persist(
    (set, get) => ({
      guestItems: [],
      addGuestItem: (item) => set((state) => {
        const existing = state.guestItems.find(i => i.partId === item.partId);
        if (existing) {
          return { guestItems: state.guestItems.map(i => i.partId === item.partId ? { ...i, quantity: i.quantity + item.quantity } : i) };
        }
        return { guestItems: [...state.guestItems, item] };
      }),
      removeGuestItem: (partId) => set((state) => ({ guestItems: state.guestItems.filter(i => i.partId !== partId) })),
      updateGuestQuantity: (partId, quantity) => set((state) => ({
        guestItems: quantity <= 0
          ? state.guestItems.filter(i => i.partId !== partId)
          : state.guestItems.map(i => i.partId === partId ? { ...i, quantity } : i),
      })),
      clearGuest: () => set({ guestItems: [] }),
      guestItemCount: () => get().guestItems.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: "parts-store-cart" }
  )
);

/** Merge guest cart to server cart after login */
export async function mergeGuestCartToServer() {
  const { guestItems, clearGuest } = useGuestCart.getState();
  if (guestItems.length === 0 || !getAccessToken()) return;
  try {
    await api("/api/store/cart/merge", {
      method: "POST",
      body: JSON.stringify({ items: guestItems.map(i => ({ partId: i.partId, quantity: i.quantity })) }),
    });
    clearGuest();
  } catch {
    // Silently fail — guest items remain in local storage
  }
}
