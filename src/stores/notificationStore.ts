import { create } from "zustand";
import { api } from "../lib/api";
import type { Notification } from "../lib/types";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetch: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const token = await invoke<string | null>("get_token", { key: "access_token" });
      if (!token) return; // not logged in, skip
      const data = await api.notifications.list();
      set({ notifications: data.notifications, unreadCount: data.unreadCount });
    } catch {}
  },

  markRead: async (id) => {
    await api.notifications.markRead(id);
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  },

  markAllRead: async () => {
    await api.notifications.markAllRead();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  startPolling: () => {
    get().fetch();
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => get().fetch(), 30000);
  },

  stopPolling: () => {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  },
}));
