import { create } from "zustand";
import { api } from "../lib/api";

interface Friend {
  id: string;
  username: string;
  avatarUrl?: string;
  online?: boolean;
}

interface DmMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  sender: { id: string; username: string; avatarUrl?: string };
  createdAt: string;
}

interface DmState {
  friends: Friend[];
  activeChatFriend: Friend | null;
  chatMessages: DmMessage[];
  panelOpen: boolean;
  unreadCount: number;

  togglePanel: () => void;
  loadFriends: () => Promise<void>;
  openChat: (friend: Friend) => Promise<void>;
  closeChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  receiveMessage: (msg: DmMessage) => void;
}

export const useDmStore = create<DmState>((set, get) => ({
  friends: [],
  activeChatFriend: null,
  chatMessages: [],
  panelOpen: false,
  unreadCount: 0,

  togglePanel: () => {
    const isOpen = !get().panelOpen;
    set({ panelOpen: isOpen });
    if (isOpen) get().loadFriends();
  },

  loadFriends: async () => {
    try {
      const res = await api.friends.list();
      const mapped = res.map((f: any) => ({
        id: f.friend?.id || f.id,
        username: f.friend?.username || f.username,
        avatarUrl: f.friend?.avatarUrl || f.avatarUrl,
        online: f.online ?? false,
      }));
      set({ friends: mapped });
    } catch { /* */ }
  },

  openChat: async (friend) => {
    set({ activeChatFriend: friend, chatMessages: [], unreadCount: 0 });
    try {
      const msgs = await api.dm.messages(friend.id);
      set({ chatMessages: msgs });
    } catch { /* */ }
  },

  closeChat: () => set({ activeChatFriend: null, chatMessages: [] }),

  // Send via REST API (reliable) — WS echo will add it to chat
  sendMessage: async (content) => {
    const { activeChatFriend } = get();
    if (!activeChatFriend || !content.trim()) return;
    try {
      const msg = await api.dm.send(activeChatFriend.id, content.trim());
      // Add immediately to chat (don't wait for WS echo)
      set({ chatMessages: [...get().chatMessages, msg] });
    } catch (e) {
      console.error("Failed to send DM:", e);
    }
  },

  receiveMessage: (msg) => {
    const { activeChatFriend, chatMessages } = get();
    // Check if this message is for the active chat
    const isActiveChat = activeChatFriend &&
      (msg.senderId === activeChatFriend.id || msg.receiverId === activeChatFriend.id);

    if (isActiveChat) {
      // Avoid duplicates (we already added it in sendMessage)
      const exists = chatMessages.some((m) => m.id === msg.id);
      if (!exists) {
        set({ chatMessages: [...chatMessages, msg] });
      }
    } else {
      set({ unreadCount: get().unreadCount + 1 });
    }
  },
}));
