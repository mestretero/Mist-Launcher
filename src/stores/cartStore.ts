import { create } from "zustand";
import { api } from "../lib/api";
import type { CartItem } from "../lib/types";

interface CartState {
  items: CartItem[];
  loading: boolean;
  fetch: () => Promise<void>;
  addItem: (gameId: string) => Promise<void>;
  removeItem: (gameId: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  loading: false,

  fetch: async () => {
    try {
      set({ loading: true });
      const data = await api.cart.get();
      set({ items: data?.items || [] });
    } catch {
      set({ items: [] });
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (gameId) => {
    await api.cart.add(gameId);
    const data = await api.cart.get();
    set({ items: data?.items || [] });
  },

  removeItem: async (gameId) => {
    await api.cart.remove(gameId);
    set((s) => ({ items: s.items.filter((i) => i.gameId !== gameId) }));
  },

  clear: async () => {
    await api.cart.clear();
    set({ items: [] });
  },
}));
