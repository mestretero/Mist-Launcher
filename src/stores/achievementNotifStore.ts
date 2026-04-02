import { create } from "zustand";

export interface AchievementNotif {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
}

interface AchievementNotifState {
  notifications: AchievementNotif[];
  show: (notif: Omit<AchievementNotif, "id">) => void;
  dismiss: (id: string) => void;
}

let nextId = 0;

export const useAchievementNotifStore = create<AchievementNotifState>((set) => ({
  notifications: [],

  show: (notif) => {
    const id = `ach-${++nextId}`;
    set((state) => ({ notifications: [...state.notifications, { ...notif, id }] }));
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
    }, 6000);
  },

  dismiss: (id) => {
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
  },
}));
