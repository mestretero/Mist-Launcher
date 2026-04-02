import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { api, setAccessToken } from "../lib/api";
import type { User } from "../lib/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingEmailVerification: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (email: string, username: string, password: string, referralCode?: string) => Promise<void>;
  confirmEmail: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  pendingEmailVerification: false,

  login: async (email, password) => {
    const result = await api.auth.login({ email, password });
    if (result.requires2FA) return result;
    const { user, tokens } = result;
    await invoke("store_token", { key: "access_token", value: tokens!.accessToken });
    await invoke("store_token", { key: "refresh_token", value: tokens!.refreshToken });
    setAccessToken(tokens!.accessToken);
    set({ user: user!, isAuthenticated: true });
    return result;
  },

  register: async (email, username, password, referralCode?) => {
    const { user, tokens } = await api.auth.register({ email, username, password, referralCode });
    // Store tokens so the user can call verify-email endpoint
    await invoke("store_token", { key: "access_token", value: tokens.accessToken });
    await invoke("store_token", { key: "refresh_token", value: tokens.refreshToken });
    setAccessToken(tokens.accessToken);
    // Don't authenticate yet — require email verification first
    set({ user, isAuthenticated: false, pendingEmailVerification: true });
  },

  confirmEmail: async (code: string) => {
    await api.auth.verifyEmail(code);
    set((s) => ({
      user: s.user ? { ...s.user, isEmailVerified: true } : null,
      isAuthenticated: true,
      pendingEmailVerification: false,
    }));
  },

  logout: async () => {
    try { await api.auth.logout(); } catch {} // best-effort server invalidation
    await invoke("delete_token", { key: "access_token" });
    await invoke("delete_token", { key: "refresh_token" });
    setAccessToken(null);
    set({ user: null, isAuthenticated: false, pendingEmailVerification: false });
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
      if (!user.isEmailVerified) {
        // Token exists but email not verified — show verification screen
        set({ user, isAuthenticated: false, pendingEmailVerification: true, isLoading: false });
        return;
      }
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
          if (!user.isEmailVerified) {
            set({ user, isAuthenticated: false, pendingEmailVerification: true, isLoading: false });
            return;
          }
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
