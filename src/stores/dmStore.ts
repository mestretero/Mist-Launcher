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

interface Conversation {
  friendId: string;
  friend: Friend;
  lastMessage: string;
  lastMessageAt: string;
  isFromMe: boolean;
}

interface DmState {
  friends: Friend[];
  conversations: Conversation[];
  activeChatFriend: Friend | null;
  chatMessages: DmMessage[];
  panelOpen: boolean;
  unreadCount: number;

  togglePanel: () => void;
  loadFriends: () => Promise<void>;
  loadConversations: () => Promise<void>;
  openChat: (friend: Friend) => Promise<void>;
  closeChat: () => void;
  sendMessage: (content: string) => void;
  receiveMessage: (msg: DmMessage) => void;
}

export const useDmStore = create<DmState>((set, get) => ({
  friends: [],
  conversations: [],
  activeChatFriend: null,
  chatMessages: [],
  panelOpen: false,
  unreadCount: 0,

  togglePanel: () => {
    const isOpen = !get().panelOpen;
    set({ panelOpen: isOpen });
    if (isOpen) {
      get().loadFriends();
      get().loadConversations();
    }
  },

  loadFriends: async () => {
    try {
      const res = await api.friends.list();
      // API returns { friendshipId, friend: { id, username, avatarUrl }, online }
      const mapped = res.map((f: any) => ({
        id: f.friend?.id || f.id,
        username: f.friend?.username || f.username,
        avatarUrl: f.friend?.avatarUrl || f.avatarUrl,
        online: f.online ?? false,
      }));
      set({ friends: mapped });
    } catch { /* */ }
  },

  loadConversations: async () => {
    try {
      const res = await api.dm.conversations();
      set({ conversations: res });
    } catch { /* */ }
  },

  openChat: async (friend) => {
    set({ activeChatFriend: friend, chatMessages: [] });
    try {
      const msgs = await api.dm.messages(friend.id);
      set({ chatMessages: msgs });
    } catch { /* */ }
  },

  closeChat: () => set({ activeChatFriend: null, chatMessages: [] }),

  sendMessage: (content) => {
    const { activeChatFriend } = get();
    if (!activeChatFriend || !content.trim()) return;
    // Send via WS — the WS handler will save to DB and echo back
    import("./roomStore").then(({ useRoomStore }) => {
      const wsClient = useRoomStore.getState().wsClient;
      if (wsClient) {
        wsClient.send("dm:send", { friendId: activeChatFriend.id, content: content.trim() });
      }
    });
  },

  receiveMessage: (msg) => {
    const { activeChatFriend } = get();
    const myChat = activeChatFriend && (msg.senderId === activeChatFriend.id || msg.receiverId === activeChatFriend.id);
    if (myChat) {
      set({ chatMessages: [...get().chatMessages, msg] });
    } else {
      // Not viewing this chat — increment unread
      set({ unreadCount: get().unreadCount + 1 });
    }
    // Update conversations
    get().loadConversations();
  },
}));
