import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { api, setAccessToken } from "../lib/api";
import type { User } from "../lib/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { user, tokens } = await api.auth.login({ email, password });
    await invoke("store_token", { key: "access_token", value: tokens.accessToken });
    await invoke("store_token", { key: "refresh_token", value: tokens.refreshToken });
    setAccessToken(tokens.accessToken);
    set({ user, isAuthenticated: true });
  },

  register: async (email, username, password) => {
    const { user, tokens } = await api.auth.register({ email, username, password });
    await invoke("store_token", { key: "access_token", value: tokens.accessToken });
    await invoke("store_token", { key: "refresh_token", value: tokens.refreshToken });
    setAccessToken(tokens.accessToken);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await invoke("delete_token", { key: "access_token" });
    await invoke("delete_token", { key: "refresh_token" });
    setAccessToken(null);
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (partial) => set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),

  loadSession: async () => {
    try {
      const token = await invoke<string | null>("get_token", { key: "access_token" });
      if (!token) {
        set({ isLoading: false });
        return;
      }
      setAccessToken(token);
      const user = await api.auth.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      try {
        const refreshToken = await invoke<string | null>("get_token", { key: "refresh_token" });
        if (refreshToken) {
          const { tokens } = await api.auth.refresh(refreshToken);
          await invoke("store_token", { key: "access_token", value: tokens.accessToken });
          await invoke("store_token", { key: "refresh_token", value: tokens.refreshToken });
          setAccessToken(tokens.accessToken);
          const user = await api.auth.me();
          set({ user, isAuthenticated: true, isLoading: false });
        } else {
          set({ isLoading: false });
        }
      } catch {
        await invoke("delete_token", { key: "access_token" });
        await invoke("delete_token", { key: "refresh_token" });
        setAccessToken(null);
        set({ isLoading: false });
      }
    }
  },
}));
