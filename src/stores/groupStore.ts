import { create } from "zustand";
import { api } from "../lib/api";
import type { Group, GroupMessage, GroupMember, GroupMemberUpdate } from "../lib/types";

interface GroupState {
  groups: Group[];
  activeGroup: Group | null;
  groupMessages: GroupMessage[];
  unreadGroups: Set<string>;

  loadGroups: () => Promise<void>;
  openGroup: (group: Group) => Promise<void>;
  closeGroup: () => void;
  sendMessage: (content: string) => Promise<void>;

  // WS event handlers
  receiveMessage: (msg: GroupMessage) => void;
  receiveMemberUpdate: (update: GroupMemberUpdate & { type: string }) => void;
  receiveGroupDeleted: (groupId: string) => void;
  receiveGroupCreated: (group: Group) => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  activeGroup: null,
  groupMessages: [],
  unreadGroups: new Set(),

  loadGroups: async () => {
    try {
      const groups = await api.groups.list();
      set({ groups });
    } catch { /* */ }
  },

  openGroup: async (group) => {
    const unreadGroups = new Set(get().unreadGroups);
    unreadGroups.delete(group.id);
    set({ activeGroup: group, groupMessages: [], unreadGroups });
    try {
      const messages = await api.groups.messages(group.id);
      set({ groupMessages: messages });
    } catch { /* */ }
  },

  closeGroup: () => set({ activeGroup: null, groupMessages: [] }),

  sendMessage: async (content) => {
    const { activeGroup } = get();
    if (!activeGroup || !content.trim()) return;
    try {
      // Don't add to list here — the WebSocket broadcast will deliver it via receiveMessage
      await api.groups.send(activeGroup.id, content.trim());
    } catch (e) {
      console.error("Failed to send group message:", e);
    }
  },

  receiveMessage: (msg) => {
    const { activeGroup, unreadGroups } = get();
    if (activeGroup?.id === msg.groupId) {
      set((state) => {
        if (state.groupMessages.some((m) => m.id === msg.id)) return state;
        return { groupMessages: [...state.groupMessages, msg] };
      });
    } else {
      const newUnread = new Set(unreadGroups);
      newUnread.add(msg.groupId);
      set({ unreadGroups: newUnread });
    }
  },

  receiveMemberUpdate: (update) => {
    const { groups, activeGroup } = get();
    if (update.type === "group:member-added" && update.member) {
      const updated = groups.map((g) =>
        g.id === update.groupId
          ? { ...g, members: [...g.members, update.member as GroupMember] }
          : g
      );
      set({ groups: updated });
      if (activeGroup?.id === update.groupId) {
        set({ activeGroup: updated.find((g) => g.id === update.groupId) || null });
      }
    } else if (
      (update.type === "group:member-kicked" || update.type === "group:member-left") &&
      update.userId
    ) {
      const updated = groups.map((g) =>
        g.id === update.groupId
          ? { ...g, members: g.members.filter((m) => m.userId !== update.userId) }
          : g
      );
      set({ groups: updated });
      if (activeGroup?.id === update.groupId) {
        set({ activeGroup: updated.find((g) => g.id === update.groupId) || null });
      }
    }
  },

  receiveGroupDeleted: (groupId) => {
    const { activeGroup, groups, unreadGroups } = get();
    const newUnread = new Set(unreadGroups);
    newUnread.delete(groupId);
    set({ groups: groups.filter((g) => g.id !== groupId), unreadGroups: newUnread });
    if (activeGroup?.id === groupId) set({ activeGroup: null, groupMessages: [] });
  },

  receiveGroupCreated: (group) => {
    const exists = get().groups.some((g) => g.id === group.id);
    if (!exists) set({ groups: [...get().groups, group] });
  },
}));
