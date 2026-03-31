# Group Chat Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add group chat to the existing DM panel — friends can create named groups, message in real-time, and manage membership.

**Architecture:** REST is canonical for all mutations (create, send, leave, kick, delete); WebSocket is broadcast-only (routes call `sendToUser` per member after DB write). ChatPanel is refactored into focused sub-components. A new `groupStore.ts` manages group state independently from `dmStore.ts`.

**Tech Stack:** Fastify 5, Prisma 7, PostgreSQL, React 19, Zustand, Tailwind CSS, @fastify/websocket

**Spec:** `docs/superpowers/specs/2026-03-31-group-chat-design.md`

---

## Chunk 1: DB Schema + Backend Service + Routes

### Task 1: Prisma Schema — Add 3 Group Models + User Back-Relations

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1.1: Add 3 new models and User back-relations**

Open `server/prisma/schema.prisma`. After the `DirectMessage` model at the end of the file, add:

```prisma
model GroupChat {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  creatorId String   @map("creator_id") @db.Uuid
  creator   User     @relation("GroupChatCreator", fields: [creatorId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")

  members  GroupChatMember[]
  messages GroupChatMessage[]

  @@map("group_chats")
}

model GroupChatMember {
  groupId  String    @map("group_id") @db.Uuid
  group    GroupChat @relation(fields: [groupId], references: [id], onDelete: Cascade)
  userId   String    @map("user_id") @db.Uuid
  user     User      @relation("GroupMemberOf", fields: [userId], references: [id])
  joinedAt DateTime  @default(now()) @map("joined_at")

  @@id([groupId, userId])
  @@map("group_chat_members")
}

model GroupChatMessage {
  id        String    @id @default(uuid()) @db.Uuid
  groupId   String    @map("group_id") @db.Uuid
  group     GroupChat @relation(fields: [groupId], references: [id], onDelete: Cascade)
  senderId  String    @map("sender_id") @db.Uuid
  sender    User      @relation("GroupChatMessageSender", fields: [senderId], references: [id])
  content   String
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([groupId, createdAt])
  @@map("group_chat_messages")
}
```

In the `User` model (around line 182–183, after `receivedDirectMessages`), add these 3 lines before `@@map("users")`:

```prisma
  createdGroups       GroupChat[]          @relation("GroupChatCreator")
  groupMemberships    GroupChatMember[]    @relation("GroupMemberOf")
  sentGroupMessages   GroupChatMessage[]   @relation("GroupChatMessageSender")
```

- [ ] **Step 1.2: Run migration**

```bash
cd server && npx prisma migrate dev --name add_group_chat
```

Expected: migration created and applied, Prisma client regenerated.

- [ ] **Step 1.3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 1.4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat: add GroupChat, GroupChatMember, GroupChatMessage prisma models"
```

---

### Task 2: group.service.ts

**Files:**
- Create: `server/src/services/group.service.ts`

- [ ] **Step 2.1: Create the service file**

Create `server/src/services/group.service.ts`:

```typescript
import { prisma } from "../lib/prisma.js";
import { forbidden, notFound } from "../lib/errors.js";

const SENDER_SELECT = { select: { id: true, username: true, avatarUrl: true } };
const MEMBER_USER_SELECT = { select: { id: true, username: true, avatarUrl: true } };

// ── Helpers ──────────────────────────────────────────

async function assertMember(groupId: string, userId: string) {
  const member = await prisma.groupChatMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member) throw forbidden("You are not a member of this group");
  return member;
}

async function assertCreator(groupId: string, userId: string) {
  const group = await prisma.groupChat.findUnique({ where: { id: groupId } });
  if (!group) throw notFound("Group not found");
  if (group.creatorId !== userId) throw forbidden("Only the creator can do this");
  return group;
}

// ── Public functions ──────────────────────────────────

export async function createGroup(creatorId: string, name: string, memberIds: string[]) {
  const uniqueMembers = [...new Set([creatorId, ...memberIds])];
  return prisma.groupChat.create({
    data: {
      name,
      creatorId,
      members: {
        create: uniqueMembers.map((userId) => ({ userId })),
      },
    },
    include: {
      members: { include: { user: MEMBER_USER_SELECT } },
    },
  });
}

export async function getUserGroups(userId: string) {
  const memberships = await prisma.groupChatMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: { include: { user: MEMBER_USER_SELECT } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: SENDER_SELECT },
          },
        },
      },
    },
  });
  return memberships.map((m) => ({
    ...m.group,
    lastMessage: m.group.messages[0] || null,
    messages: undefined,
  }));
}

export async function getGroupMessages(groupId: string, userId: string) {
  await assertMember(groupId, userId);
  // Fetch newest 50, then reverse so they're oldest-first in the UI
  const messages = await prisma.groupChatMessage.findMany({
    where: { groupId },
    include: { sender: SENDER_SELECT },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return messages.reverse();
}

export async function sendMessage(groupId: string, senderId: string, content: string) {
  await assertMember(groupId, senderId);
  return prisma.groupChatMessage.create({
    data: { groupId, senderId, content },
    include: { sender: SENDER_SELECT },
  });
}

export async function addMember(groupId: string, requesterId: string, newUserId: string) {
  await assertCreator(groupId, requesterId);
  // Check they are friends
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: requesterId, receiverId: newUserId },
        { senderId: newUserId, receiverId: requesterId },
      ],
    },
  });
  if (!friendship) throw forbidden("You can only add friends to a group");
  return prisma.groupChatMember.create({
    data: { groupId, userId: newUserId },
    include: { user: MEMBER_USER_SELECT },
  });
}

export async function removeMember(groupId: string, requesterId: string, targetUserId: string) {
  await assertCreator(groupId, requesterId);
  if (requesterId === targetUserId) throw forbidden("Use leaveGroup to leave");
  const exists = await prisma.groupChatMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });
  if (!exists) throw notFound("Member not found");
  await prisma.groupChatMember.delete({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });
}

export async function leaveGroup(groupId: string, userId: string) {
  await assertMember(groupId, userId);
  const group = await prisma.groupChat.findUnique({ where: { id: groupId } });
  if (!group) throw notFound("Group not found");

  if (group.creatorId === userId) {
    // Creator leaving deletes the group (cascade removes members + messages)
    await prisma.groupChat.delete({ where: { id: groupId } });
    return { deleted: true };
  }

  await prisma.groupChatMember.delete({
    where: { groupId_userId: { groupId, userId } },
  });
  return { deleted: false };
}

export async function deleteGroup(groupId: string, requesterId: string) {
  await assertCreator(groupId, requesterId);
  await prisma.groupChat.delete({ where: { id: groupId } });
}

export async function getGroupMembers(groupId: string, userId: string) {
  await assertMember(groupId, userId);
  const members = await prisma.groupChatMember.findMany({
    where: { groupId },
    include: { user: MEMBER_USER_SELECT },
  });
  return members;
}

// Called by dm.service cleanup job — deletes group messages older than 8 hours
export async function cleanupOldMessages() {
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const result = await prisma.groupChatMessage.deleteMany({
    where: { createdAt: { lt: eightHoursAgo } },
  });
  if (result.count > 0) console.log(`Cleaned up ${result.count} old group messages`);
}
```

- [ ] **Step 2.2: Check server TypeScript**

```bash
cd server && npx tsc --noEmit
```

Expected: 0 errors. If `notFound` is not exported from `errors.ts`, check what's available (likely `notFound` or `AppError` — adjust import accordingly).

- [ ] **Step 2.3: Commit**

```bash
git add server/src/services/group.service.ts
git commit -m "feat: add group.service.ts with CRUD, membership, and cleanup"
```

---

### Task 3: Update dm.service.ts Cleanup

**Files:**
- Modify: `server/src/services/dm.service.ts`

- [ ] **Step 3.1: Add group message cleanup call**

In `server/src/services/dm.service.ts`, update `cleanupOldMessages`:

```typescript
// Delete messages older than 8 hours (DM + group)
export async function cleanupOldMessages() {
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const dmResult = await prisma.directMessage.deleteMany({
    where: { createdAt: { lt: eightHoursAgo } },
  });
  if (dmResult.count > 0) console.log(`Cleaned up ${dmResult.count} old direct messages`);

  // Import lazily to avoid circular deps
  const groupService = await import("./group.service.js");
  await groupService.cleanupOldMessages();
}
```

- [ ] **Step 3.2: Verify TypeScript**

```bash
cd server && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3.3: Commit**

```bash
git add server/src/services/dm.service.ts
git commit -m "feat: include group message cleanup in dm cleanup job"
```

---

### Task 4: group REST Routes

**Files:**
- Create: `server/src/routes/groups.ts`

- [ ] **Step 4.1: Create the routes file**

Create `server/src/routes/groups.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import * as groupService from "../services/group.service.js";
import { sendToUser } from "../ws/gateway.js";

export default async function groupRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // Create a group
  app.post("/groups", async (request, reply) => {
    const userId = request.user!.userId;
    const { name, memberIds } = request.body as { name: string; memberIds: string[] };
    if (!name?.trim()) return reply.status(400).send({ error: { message: "Group name required" } });
    if (!memberIds?.length) return reply.status(400).send({ error: { message: "Select at least one member" } });

    const group = await groupService.createGroup(userId, name.trim(), memberIds);

    // Notify all members via WS
    const allMemberIds = group.members.map((m: any) => m.userId);
    for (const memberId of allMemberIds) {
      sendToUser(memberId, { type: "group:created", payload: group });
    }

    return reply.status(201).send({ data: group });
  });

  // List user's groups
  app.get("/groups", async (request) => {
    const userId = request.user!.userId;
    const groups = await groupService.getUserGroups(userId);
    return { data: groups };
  });

  // Get group messages
  app.get("/groups/:id/messages", async (request) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const messages = await groupService.getGroupMessages(id, userId);
    return { data: messages };
  });

  // Send a message
  app.post("/groups/:id/messages", async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };
    if (!content?.trim()) return reply.status(400).send({ error: { message: "Empty message" } });

    const message = await groupService.sendMessage(id, userId, content.trim());

    // Broadcast to all group members
    const members = await groupService.getGroupMembers(id, userId);
    for (const member of members) {
      sendToUser(member.userId, { type: "group:message", payload: { ...message, groupId: id } });
    }

    return reply.status(201).send({ data: message });
  });

  // Add a member (creator only)
  app.post("/groups/:id/members", async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const { newUserId } = request.body as { newUserId: string };

    // Get members BEFORE adding (so we can notify existing members)
    const existingMembers = await groupService.getGroupMembers(id, userId);
    // Add member
    const newMember = await groupService.addMember(id, userId, newUserId);
    // Notify all existing members + the newly added user (total: no duplicates)
    const toNotify = [...existingMembers.map((m: any) => m.userId), newUserId];
    for (const memberId of toNotify) {
      sendToUser(memberId, { type: "group:member-added", payload: { groupId: id, member: newMember } });
    }

    return reply.status(201).send({ data: newMember });
  });

  // Remove a member (creator only)

  app.delete("/groups/:id/members/:userId", async (request, reply) => {
    const requesterId = request.user!.userId;
    const { id, userId: targetId } = request.params as { id: string; userId: string };

    // Get members BEFORE removing (includes targetId) — for broadcast
    const members = await groupService.getGroupMembers(id, requesterId);
    await groupService.removeMember(id, requesterId, targetId);

    // Notify all members including the kicked user (already in the pre-remove list)
    for (const member of members) {
      sendToUser(member.userId, { type: "group:member-kicked", payload: { groupId: id, userId: targetId } });
    }

    return reply.status(204).send();
  });

  // Leave group
  app.delete("/groups/:id/leave", async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    // Get members BEFORE leaving (for broadcast)
    const members = await groupService.getGroupMembers(id, userId);
    const result = await groupService.leaveGroup(id, userId);

    if (result.deleted) {
      // Creator left — group deleted — notify all
      for (const member of members) {
        sendToUser(member.userId, { type: "group:deleted", payload: { groupId: id } });
      }
    } else {
      // Regular leave — notify remaining members
      for (const member of members) {
        if (member.userId !== userId) {
          sendToUser(member.userId, { type: "group:member-left", payload: { groupId: id, userId } });
        }
      }
    }

    return reply.status(204).send();
  });

  // Delete group (creator only)
  app.delete("/groups/:id", async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    // Get members BEFORE deleting (for broadcast)
    const members = await groupService.getGroupMembers(id, userId);
    await groupService.deleteGroup(id, userId);

    for (const member of members) {
      sendToUser(member.userId, { type: "group:deleted", payload: { groupId: id } });
    }

    return reply.status(204).send();
  });
}
```

- [ ] **Step 4.2: Register routes in app.ts**

In `server/src/app.ts`, add after the `dmRoutes` import and registration:

```typescript
// Import (top of file with other imports):
import groupRoutes from "./routes/groups.js";

// Registration (after `await app.register(dmRoutes);`):
await app.register(groupRoutes);
```

- [ ] **Step 4.3: Verify TypeScript**

```bash
cd server && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4.4: Commit**

```bash
git add server/src/routes/groups.ts server/src/app.ts
git commit -m "feat: add group REST routes with WS broadcast"
```

---

## Chunk 2: Frontend Types + API + Store

### Task 5: TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 5.1: Add group types at the end of types.ts**

```typescript
export interface GroupMember {
  groupId: string;
  userId: string;
  joinedAt: string;
  user: { id: string; username: string; avatarUrl?: string };
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  content: string;
  sender: { id: string; username: string; avatarUrl?: string };
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  creatorId: string;
  createdAt: string;
  members: GroupMember[];
  lastMessage?: GroupMessage | null;
}

export interface GroupMemberUpdate {
  groupId: string;
  userId?: string;
  member?: GroupMember;
}
```

- [ ] **Step 5.2: Verify frontend TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5.3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add Group, GroupMessage, GroupMember TypeScript types"
```

---

### Task 6: API Client — Groups Namespace

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 6.1: Add groups namespace**

In `src/lib/api.ts`, add the `groups` namespace after the `dm` object (before `rooms`):

```typescript
  groups: {
    list: () => request<Group[]>("/groups"),
    messages: (groupId: string) => request<GroupMessage[]>(`/groups/${groupId}/messages`),
    send: (groupId: string, content: string) =>
      request<GroupMessage>(`/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ content }) }),
    create: (name: string, memberIds: string[]) =>
      request<Group>("/groups", { method: "POST", body: JSON.stringify({ name, memberIds }) }),
    addMember: (groupId: string, newUserId: string) =>
      request<GroupMember>(`/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ newUserId }) }),
    removeMember: (groupId: string, userId: string) =>
      request<void>(`/groups/${groupId}/members/${userId}`, { method: "DELETE" }),
    leave: (groupId: string) =>
      request<void>(`/groups/${groupId}/leave`, { method: "DELETE" }),
    delete: (groupId: string) =>
      request<void>(`/groups/${groupId}`, { method: "DELETE" }),
  },
```

Also add the import for Group/GroupMessage types at the top of `api.ts` if they're not already imported from `types.ts`.

- [ ] **Step 6.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6.3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add groups API namespace"
```

---

### Task 7: groupStore.ts

**Files:**
- Create: `src/stores/groupStore.ts`

- [ ] **Step 7.1: Create the store**

Create `src/stores/groupStore.ts`:

```typescript
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
      const msg = await api.groups.send(activeGroup.id, content.trim());
      // Add immediately (WS echo will be deduplicated)
      set({ groupMessages: [...get().groupMessages, msg] });
    } catch (e) {
      console.error("Failed to send group message:", e);
    }
  },

  receiveMessage: (msg) => {
    const { activeGroup, groupMessages, unreadGroups } = get();
    if (activeGroup?.id === msg.groupId) {
      const exists = groupMessages.some((m) => m.id === msg.id);
      if (!exists) set({ groupMessages: [...groupMessages, msg] });
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
```

- [ ] **Step 7.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7.3: Commit**

```bash
git add src/stores/groupStore.ts
git commit -m "feat: add groupStore.ts with Zustand state management"
```

---

### Task 8: Wire WS Events in roomStore.ts

**Files:**
- Modify: `src/stores/roomStore.ts`

- [ ] **Step 8.1: Add group:* cases to handleWsMessage**

In `src/stores/roomStore.ts`, find the `case "dm:message":` block (around line 300). After its `break;`, add:

```typescript
    case "group:message":
      import("./groupStore").then(({ useGroupStore }) => {
        useGroupStore.getState().receiveMessage(payload);
      });
      if (document.hidden) {
        const sender = (payload as any).sender?.username || "Group";
        try {
          if (Notification.permission === "granted") {
            new Notification(sender, { body: (payload as any).content, silent: false });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        } catch { /* */ }
      }
      break;

    case "group:member-added":
    case "group:member-kicked":
    case "group:member-left":
      import("./groupStore").then(({ useGroupStore }) => {
        useGroupStore.getState().receiveMemberUpdate({ ...(payload as any), type });
      });
      break;

    case "group:deleted":
      import("./groupStore").then(({ useGroupStore }) => {
        useGroupStore.getState().receiveGroupDeleted((payload as any).groupId);
      });
      break;

    case "group:created":
      import("./groupStore").then(({ useGroupStore }) => {
        useGroupStore.getState().receiveGroupCreated(payload as any);
      });
      break;
```

Also, ensure the `loadGroups` is called when the panel opens. In `groupStore.ts`'s `loadGroups` it's called from `togglePanel` of the DM store equivalent — but for groups, it's called from `ChatPanel` when opened (see Task 10).

- [ ] **Step 8.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8.3: Commit**

```bash
git add src/stores/roomStore.ts
git commit -m "feat: add group:* WebSocket event handling in roomStore"
```

---

## Chunk 3: ChatPanel Refactor + Group UI

### Task 9: Extract FriendsList.tsx

**Files:**
- Create: `src/components/FriendsList.tsx`

The goal: move the friends list + context menu logic OUT of ChatPanel into its own component.

- [ ] **Step 9.1: Create FriendsList.tsx**

Create `src/components/FriendsList.tsx`:

```tsx
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface Friend {
  id: string;
  username: string;
  avatarUrl?: string;
  online?: boolean;
}

interface Props {
  friends: Friend[];
  activeFriendId?: string;
  onSelectFriend: (friend: Friend) => void;
  onNavigate: (page: string, slug?: string) => void;
  onCreateGroup: (friend: Friend) => void;
  onTogglePanel: () => void;
}

export function FriendsList({ friends, activeFriendId, onSelectFriend, onNavigate, onCreateGroup, onTogglePanel }: Props) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; friend: Friend } | null>(null);

  useEffect(() => {
    function close() { setContextMenu(null); }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const sorted = [...friends].sort((a, b) => {
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return a.username.localeCompare(b.username);
  });
  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <>
      <div className="overflow-y-auto" style={{ maxHeight: 404 }}>
        {onlineCount > 0 && (
          <div className="px-3 pt-2.5 pb-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/60">{t("chat.online")} — {onlineCount}</span>
          </div>
        )}
        {sorted.filter((f) => f.online).map((f) => (
          <FriendRow key={f.id} friend={f} isActive={activeFriendId === f.id}
            onClick={() => onSelectFriend(f)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, friend: f }); }} />
        ))}
        {sorted.some((f) => !f.online) && (
          <div className="px-3 pt-2.5 pb-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#67707b]/60">{t("chat.offline")}</span>
          </div>
        )}
        {sorted.filter((f) => !f.online).map((f) => (
          <FriendRow key={f.id} friend={f} isActive={activeFriendId === f.id}
            onClick={() => onSelectFriend(f)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, friend: f }); }} />
        ))}
        {friends.length === 0 && (
          <p className="text-[11px] text-[#67707b] text-center py-6">{t("chat.noFriends")}</p>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[100] bg-[#1a1c23] border border-[#2a2e38] rounded-xl shadow-2xl shadow-black/50 py-1 min-w-[160px] overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y - 100 }}
        >
          <button
            onClick={() => { onNavigate("user-profile", contextMenu.friend.username); onTogglePanel(); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#c6d4df] hover:bg-[#1a9fff]/10 hover:text-[#1a9fff] cursor-pointer transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            {t("chat.viewProfile")}
          </button>
          <button
            onClick={() => { onSelectFriend(contextMenu.friend); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#c6d4df] hover:bg-[#1a9fff]/10 hover:text-[#1a9fff] cursor-pointer transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {t("chat.sendMessage")}
          </button>
          <div className="h-px bg-[#2a2e38] mx-2 my-1" />
          <button
            onClick={() => { onCreateGroup(contextMenu.friend); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#c6d4df] hover:bg-[#1a9fff]/10 hover:text-[#1a9fff] cursor-pointer transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {t("chat.createGroup")}
          </button>
        </div>
      )}
    </>
  );
}

// ── FriendRow (same as before, extracted) ──────────────

function FriendRow({ friend, isActive, onClick, onContextMenu }: {
  friend: Friend; isActive: boolean; onClick: () => void; onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const initials = friend.username.slice(0, 2).toUpperCase();
  return (
    <button onClick={onClick} onContextMenu={onContextMenu}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-all ${isActive ? "bg-[#1a9fff]/10 border-l-2 border-[#1a9fff]" : "hover:bg-[#20232c]/60 border-l-2 border-transparent"}`}>
      <div className="relative flex-shrink-0">
        {friend.avatarUrl ? (
          <img src={friend.avatarUrl.startsWith("http") ? friend.avatarUrl : `http://localhost:3001${friend.avatarUrl}`} alt="" className="w-8 h-8 rounded-lg object-cover" />
        ) : (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${friend.online ? "bg-gradient-to-br from-[#1a9fff]/30 to-[#1a1c23] text-[#c6d4df]" : "bg-[#20232c] text-[#67707b]"}`}>{initials}</div>
        )}
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1a1c23] ${friend.online ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]" : "bg-[#3d4450]"}`} />
      </div>
      <span className={`text-[13px] font-medium truncate ${friend.online ? "text-[#c6d4df]" : "text-[#67707b]"}`}>{friend.username}</span>
    </button>
  );
}
```

- [ ] **Step 9.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 9.3: Commit**

```bash
git add src/components/FriendsList.tsx
git commit -m "feat: extract FriendsList component from ChatPanel with group create option"
```

---

### Task 10: Extract ChatView.tsx

**Files:**
- Create: `src/components/ChatView.tsx`

- [ ] **Step 10.1: Create ChatView.tsx**

Create `src/components/ChatView.tsx` — the DM chat panel (left sliding area) extracted from ChatPanel:

```tsx
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface DmMessage {
  id: string;
  senderId: string;
  content: string;
  sender?: { username: string };
  createdAt: string;
}

interface Friend {
  id: string;
  username: string;
  avatarUrl?: string;
  online?: boolean;
}

interface Props {
  friend: Friend;
  messages: DmMessage[];
  currentUserId: string;
  onClose: () => void;
  onSend: (content: string) => Promise<void>;
  onNavigate: (page: string, slug?: string) => void;
  onTogglePanel: () => void;
}

export function ChatView({ friend, messages, currentUserId, onClose, onSend, onNavigate, onTogglePanel }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    await onSend(text);
  }

  return (
    <div className="w-[340px] h-full flex flex-col bg-[#0f1115] border border-[#2a2e38] border-r-0 rounded-tl-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1c23]/60 border-b border-[#2a2e38]">
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#2a2e38] text-[#67707b] hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button
          onClick={() => { onNavigate("user-profile", friend.username); onTogglePanel(); }}
          className="flex items-center gap-2.5 cursor-pointer hover:bg-[#20232c] rounded-lg px-1.5 py-1 -mx-1.5 -my-1 transition-colors"
        >
          <div className="relative">
            {friend.avatarUrl ? (
              <img src={friend.avatarUrl.startsWith("http") ? friend.avatarUrl : `http://localhost:3001${friend.avatarUrl}`} alt="" className="w-8 h-8 rounded-lg object-cover ring-2 ring-[#2a2e38]" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a9fff]/30 to-[#1a1c23] flex items-center justify-center text-[10px] font-black text-[#c6d4df] ring-2 ring-[#2a2e38]">
                {friend.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            {friend.online && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#1a1c23]" />}
          </div>
          <div className="text-left">
            <span className="text-[13px] font-bold text-white block leading-tight">{friend.username}</span>
            <span className={`text-[10px] leading-tight ${friend.online ? "text-emerald-400" : "text-[#67707b]"}`}>
              {friend.online ? t("chat.online") : t("chat.offline")}
            </span>
          </div>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#2a2e38] mb-2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-[11px] text-[#67707b]">{t("chat.noMessages")}</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                {!isMine && (
                  <span className="text-[10px] font-semibold text-[#1a9fff]/60 mb-0.5 block px-1">
                    {msg.sender?.username}
                  </span>
                )}
                <div className={`px-3 py-2 text-[13px] leading-snug ${
                  isMine ? "bg-[#1a9fff] text-white rounded-2xl rounded-br-sm" : "bg-[#1a1c23] text-[#c6d4df] border border-[#2a2e38] rounded-2xl rounded-bl-sm"
                }`}>{msg.content}</div>
                <span className="text-[8px] text-[#67707b]/40 mt-0.5 block px-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#2a2e38]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={t("chat.messagePlaceholder")}
            className="flex-1 px-3 py-2.5 bg-[#1a1c23] border border-[#2a2e38] rounded-xl text-[13px] text-[#c6d4df] placeholder:text-[#67707b]/40 focus:border-[#1a9fff]/50 outline-none"
            autoFocus
          />
          <button onClick={handleSend} disabled={!input.trim()}
            className="px-3 py-2.5 bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white rounded-xl disabled:opacity-20 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 10.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 10.3: Commit**

```bash
git add src/components/ChatView.tsx
git commit -m "feat: extract ChatView DM component from ChatPanel"
```

---

### Task 11: GroupList.tsx

**Files:**
- Create: `src/components/GroupList.tsx`

- [ ] **Step 11.1: Create GroupList.tsx**

Create `src/components/GroupList.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import type { Group } from "../lib/types";

interface Props {
  groups: Group[];
  activeGroupId?: string;
  unreadGroups: Set<string>;
  onSelectGroup: (group: Group) => void;
}

export function GroupList({ groups, activeGroupId, unreadGroups, onSelectGroup }: Props) {
  const { t } = useTranslation();

  if (groups.length === 0) return (
    <p className="text-[11px] text-[#67707b] text-center py-4">{t("chat.noGroups")}</p>
  );

  return (
    <div>
      {groups.map((group) => {
        const isUnread = unreadGroups.has(group.id);
        const isActive = activeGroupId === group.id;
        const initials = group.name.slice(0, 2).toUpperCase();
        return (
          <button key={group.id} onClick={() => onSelectGroup(group)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-all ${isActive ? "bg-[#1a9fff]/10 border-l-2 border-[#1a9fff]" : "hover:bg-[#20232c]/60 border-l-2 border-transparent"}`}>
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c3aed]/30 to-[#1a1c23] flex items-center justify-center text-[10px] font-black text-[#c6d4df]">
                {initials}
              </div>
              {isUnread && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-medium truncate text-[#c6d4df] block">{group.name}</span>
              {group.lastMessage && (
                <span className="text-[10px] text-[#67707b] truncate block">
                  {group.lastMessage.sender.username}: {group.lastMessage.content}
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#67707b]/60 ml-1">{group.members.length}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 11.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 11.3: Commit**

```bash
git add src/components/GroupList.tsx
git commit -m "feat: add GroupList component"
```

---

### Task 12: GroupChatView.tsx

**Files:**
- Create: `src/components/GroupChatView.tsx`

This component has two views: chat and member management (toggled by ⚙️ button).

- [ ] **Step 12.1: Create GroupChatView.tsx**

Create `src/components/GroupChatView.tsx`:

```tsx
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Group, GroupMessage } from "../lib/types";
import { api } from "../lib/api";
import { useGroupStore } from "../stores/groupStore";

interface Props {
  group: Group;
  messages: GroupMessage[];
  currentUserId: string;
  onClose: () => void;
  onSend: (content: string) => Promise<void>;
}

export function GroupChatView({ group, messages, currentUserId, onClose, onSend }: Props) {
  const { t } = useTranslation();
  const { loadGroups } = useGroupStore();
  const [input, setInput] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState("");
  const [localGroup, setLocalGroup] = useState(group);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep localGroup in sync with store
  useEffect(() => { setLocalGroup(group); }, [group]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isCreator = localGroup.creatorId === currentUserId;

  async function handleSend() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    await onSend(text);
  }

  async function handleKick(userId: string) {
    try {
      await api.groups.removeMember(localGroup.id, userId);
      await loadGroups();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleLeave() {
    const warn = isCreator ? t("chat.creatorLeaveWarning") : "";
    if (warn && !window.confirm(warn)) return;
    try {
      await api.groups.leave(localGroup.id);
      onClose();
      await loadGroups();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddMember() {
    if (!addingFriendId.trim()) return;
    try {
      await api.groups.addMember(localGroup.id, addingFriendId.trim());
      setAddingFriendId("");
      await loadGroups();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="w-[340px] h-full flex flex-col bg-[#0f1115] border border-[#2a2e38] border-r-0 rounded-tl-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1c23]/60 border-b border-[#2a2e38]">
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#2a2e38] text-[#67707b] hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-bold text-white block leading-tight truncate">{localGroup.name}</span>
          <span className="text-[10px] text-[#67707b]">{localGroup.members.length} {t("chat.members")}</span>
        </div>
        <button onClick={() => setShowMembers(!showMembers)}
          className={`p-1.5 rounded-lg transition-colors ${showMembers ? "bg-[#1a9fff]/20 text-[#1a9fff]" : "hover:bg-[#2a2e38] text-[#67707b] hover:text-white"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
        </button>
      </div>

      {showMembers ? (
        /* ── Member Management View ── */
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#67707b]/60 px-1 pb-1">{t("chat.members")}</p>
          {localGroup.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#20232c]/40">
              <div className="w-7 h-7 rounded-lg bg-[#20232c] flex items-center justify-center text-[10px] font-black text-[#c6d4df]">
                {m.user.username.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 text-[12px] text-[#c6d4df] truncate">{m.user.username}</span>
              {localGroup.creatorId === m.userId && (
                <span className="text-[9px] text-[#1a9fff]/60 px-1.5 py-0.5 bg-[#1a9fff]/10 rounded">{t("chat.creator")}</span>
              )}
              {isCreator && m.userId !== currentUserId && (
                <button onClick={() => handleKick(m.userId)}
                  className="text-[10px] text-red-400/60 hover:text-red-400 px-1.5 py-0.5 hover:bg-red-400/10 rounded transition-colors cursor-pointer">
                  {t("chat.removeMember")}
                </button>
              )}
            </div>
          ))}

          {isCreator && (
            <div className="pt-2 border-t border-[#2a2e38]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#67707b]/60 px-1 pb-2">{t("chat.addMember")}</p>
              <div className="flex gap-2">
                <input
                  value={addingFriendId}
                  onChange={(e) => setAddingFriendId(e.target.value)}
                  placeholder="User ID..."
                  className="flex-1 px-2 py-1.5 bg-[#1a1c23] border border-[#2a2e38] rounded-lg text-[12px] text-[#c6d4df] placeholder:text-[#67707b]/40 focus:border-[#1a9fff]/50 outline-none"
                />
                <button onClick={handleAddMember} disabled={!addingFriendId.trim()}
                  className="px-2 py-1.5 bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white rounded-lg text-[11px] disabled:opacity-30 transition-all cursor-pointer">
                  +
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[#2a2e38]">
            <button onClick={handleLeave}
              className="w-full py-2 text-[12px] text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer">
              {t("chat.leaveGroup")}
            </button>
          </div>
        </div>
      ) : (
        /* ── Chat View ── */
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-[11px] text-[#67707b]">{t("chat.noMessages")}</p>
              </div>
            )}
            {messages.map((msg) => {
              const isMine = msg.senderId === currentUserId;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%]">
                    {!isMine && (
                      <span className="text-[10px] font-semibold text-[#1a9fff]/60 mb-0.5 block px-1">
                        {msg.sender?.username}
                      </span>
                    )}
                    <div className={`px-3 py-2 text-[13px] leading-snug ${
                      isMine ? "bg-[#1a9fff] text-white rounded-2xl rounded-br-sm" : "bg-[#1a1c23] text-[#c6d4df] border border-[#2a2e38] rounded-2xl rounded-bl-sm"
                    }`}>{msg.content}</div>
                    <span className="text-[8px] text-[#67707b]/40 mt-0.5 block px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <div className="p-3 border-t border-[#2a2e38]">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={t("chat.messagePlaceholder")}
                className="flex-1 px-3 py-2.5 bg-[#1a1c23] border border-[#2a2e38] rounded-xl text-[13px] text-[#c6d4df] placeholder:text-[#67707b]/40 focus:border-[#1a9fff]/50 outline-none"
                autoFocus
              />
              <button onClick={handleSend} disabled={!input.trim()}
                className="px-3 py-2.5 bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white rounded-xl disabled:opacity-20 transition-all cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 12.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 12.3: Commit**

```bash
git add src/components/GroupChatView.tsx
git commit -m "feat: add GroupChatView component with chat + member management"
```

---

### Task 13: CreateGroupModal.tsx

**Files:**
- Create: `src/components/CreateGroupModal.tsx`

- [ ] **Step 13.1: Create CreateGroupModal.tsx**

Create `src/components/CreateGroupModal.tsx`:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useGroupStore } from "../stores/groupStore";

interface Friend {
  id: string;
  username: string;
  avatarUrl?: string;
  online?: boolean;
}

interface Props {
  friends: Friend[];
  preselectedFriend?: Friend;
  onClose: () => void;
}

export function CreateGroupModal({ friends, preselectedFriend, onClose }: Props) {
  const { t } = useTranslation();
  const { loadGroups } = useGroupStore();
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    preselectedFriend ? new Set([preselectedFriend.id]) : new Set()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleFriend(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  async function handleCreate() {
    if (!groupName.trim()) { setError(t("chat.groupName") + " required"); return; }
    if (selectedIds.size === 0) { setError(t("chat.atLeastOneMember")); return; }
    setLoading(true);
    setError("");
    try {
      await api.groups.create(groupName.trim(), Array.from(selectedIds));
      await loadGroups();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1a1c23] border border-[#2a2e38] rounded-2xl w-[340px] max-h-[500px] flex flex-col shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2e38]">
          <span className="text-[15px] font-bold text-white">{t("chat.createGroup")}</span>
          <button onClick={onClose} className="text-[#67707b] hover:text-white transition-colors cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Group name */}
        <div className="px-5 pt-4 pb-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-[#67707b]/60 block mb-1.5">{t("chat.groupName")}</label>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t("chat.groupNamePlaceholder")}
            className="w-full px-3 py-2.5 bg-[#0f1115] border border-[#2a2e38] rounded-xl text-[13px] text-[#c6d4df] placeholder:text-[#67707b]/40 focus:border-[#1a9fff]/50 outline-none"
            autoFocus
          />
        </div>

        {/* Friend selection */}
        <div className="px-5 pb-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-[#67707b]/60 block mb-1.5">{t("chat.selectFriends")}</label>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {friends.map((f) => {
            const checked = selectedIds.has(f.id);
            return (
              <button key={f.id} onClick={() => toggleFriend(f.id)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-all ${checked ? "bg-[#1a9fff]/10" : "hover:bg-[#20232c]/60"}`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? "bg-[#1a9fff] border-[#1a9fff]" : "border-[#2a2e38]"}`}>
                  {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${f.online ? "bg-gradient-to-br from-[#1a9fff]/30 to-[#1a1c23] text-[#c6d4df]" : "bg-[#20232c] text-[#67707b]"}`}>
                  {f.username.slice(0, 2).toUpperCase()}
                </div>
                <span className={`text-[12px] font-medium ${f.online ? "text-[#c6d4df]" : "text-[#67707b]"}`}>{f.username}</span>
                {f.online && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-auto" />}
              </button>
            );
          })}
          {friends.length === 0 && <p className="text-[11px] text-[#67707b] text-center py-4">{t("chat.noFriends")}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-2 border-t border-[#2a2e38]">
          {error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 text-[12px] text-[#67707b] hover:text-white border border-[#2a2e38] hover:border-[#3d4450] rounded-xl transition-all cursor-pointer">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={loading || !groupName.trim() || selectedIds.size === 0}
              className="flex-1 py-2 text-[12px] text-white bg-[#1a9fff] hover:bg-[#1a9fff]/80 rounded-xl disabled:opacity-30 transition-all cursor-pointer">
              {loading ? "..." : t("chat.createGroup")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 13.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 13.3: Commit**

```bash
git add src/components/CreateGroupModal.tsx
git commit -m "feat: add CreateGroupModal with friend checkbox selection"
```

---

### Task 14: Refactor ChatPanel.tsx + Wire Everything

**Files:**
- Modify: `src/components/ChatPanel.tsx`

- [ ] **Step 14.1: Replace ChatPanel.tsx with container**

Replace the entire content of `src/components/ChatPanel.tsx` with the new container that uses all extracted components:

```tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDmStore } from "../stores/dmStore";
import { useGroupStore } from "../stores/groupStore";
import { useAuthStore } from "../stores/authStore";
import { FriendsList } from "./FriendsList";
import { ChatView } from "./ChatView";
import { GroupList } from "./GroupList";
import { GroupChatView } from "./GroupChatView";
import { CreateGroupModal } from "./CreateGroupModal";

interface Props {
  onNavigate: (page: string, slug?: string) => void;
}

export function ChatPanel({ onNavigate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    friends, panelOpen, togglePanel,
    activeChatFriend, chatMessages,
    openChat, closeChat, sendMessage, unreadCount,
  } = useDmStore();
  const {
    groups, activeGroup, groupMessages, unreadGroups,
    loadGroups, openGroup, closeGroup, sendMessage: sendGroupMessage,
  } = useGroupStore();

  const [createGroupFor, setCreateGroupFor] = useState<any | null>(null);

  // Load groups when panel opens
  useEffect(() => {
    if (panelOpen) loadGroups();
  }, [panelOpen]);

  const hasActiveChat = panelOpen && (activeChatFriend || activeGroup);
  const totalUnread = unreadCount + unreadGroups.size;

  const chatContent = activeChatFriend ? (
    <ChatView
      friend={activeChatFriend}
      messages={chatMessages}
      currentUserId={user?.id || ""}
      onClose={closeChat}
      onSend={sendMessage}
      onNavigate={onNavigate}
      onTogglePanel={togglePanel}
    />
  ) : activeGroup ? (
    <GroupChatView
      group={activeGroup}
      messages={groupMessages}
      currentUserId={user?.id || ""}
      onClose={closeGroup}
      onSend={sendGroupMessage}
    />
  ) : null;

  return (
    <>
      <div className="fixed bottom-0 right-0 z-50 flex items-end">
        {/* ─── Chat (left) ─── */}
        <div
          className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            width: hasActiveChat ? 340 : 0,
            height: panelOpen ? 440 : 36,
            opacity: hasActiveChat ? 1 : 0,
          }}
        >
          {chatContent}
        </div>

        {/* ─── Friends + Groups Panel (right) ─── */}
        <div
          className={`w-[280px] bg-[#1a1c23] border border-[#2a2e38] overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            hasActiveChat ? "rounded-tr-2xl" : "rounded-t-2xl"
          }`}
          style={{ height: panelOpen ? 440 : 36 }}
        >
          {/* Header toggle */}
          <button onClick={togglePanel} className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#20232c] cursor-pointer transition-colors" style={{ height: 36 }}>
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#1a9fff]">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-[12px] font-bold text-[#c6d4df]">{t("chat.friendsAndChat")}</span>
              {friends.filter((f) => f.online).length > 0 && (
                <span className="text-[10px] text-emerald-400">({friends.filter((f) => f.online).length})</span>
              )}
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{totalUnread}</span>
              )}
            </div>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`text-[#67707b] transition-transform duration-300 ${panelOpen ? "rotate-180" : ""}`}>
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          {/* Scrollable content */}
          <div className="border-t border-[#2a2e38] overflow-y-auto" style={{ maxHeight: 404 }}>
            {/* Friends section */}
            <FriendsList
              friends={friends}
              activeFriendId={activeChatFriend?.id}
              onSelectFriend={(f) => { closeGroup(); openChat(f); }}
              onNavigate={onNavigate}
              onCreateGroup={(f) => setCreateGroupFor(f)}
              onTogglePanel={togglePanel}
            />

            {/* Groups section */}
            <div className="px-3 pt-3 pb-1 border-t border-[#2a2e38]/50">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#7c3aed]/60">{t("chat.groups")}</span>
            </div>
            <GroupList
              groups={groups}
              activeGroupId={activeGroup?.id}
              unreadGroups={unreadGroups}
              onSelectGroup={(g) => { closeChat(); openGroup(g); }}
            />
          </div>
        </div>
      </div>

      {/* ─── Create Group Modal ─── */}
      {createGroupFor && (
        <CreateGroupModal
          friends={friends}
          preselectedFriend={createGroupFor}
          onClose={() => setCreateGroupFor(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 14.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If there are type mismatches (e.g., `Friend` interface between dmStore and FriendsList), adjust to use the inline type or import a shared type.

- [ ] **Step 14.3: Verify DM flow still works**

Start the dev server and verify:
1. ChatPanel opens/closes with accordion animation
2. Clicking a friend opens DM chat (left panel slides in)
3. Sending a DM works
4. Right-click shows context menu with "Grup Sohbeti Oluştur" option

- [ ] **Step 14.4: Commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "refactor: ChatPanel → container using FriendsList, ChatView, GroupList, GroupChatView"
```

---

## Chunk 4: i18n + Final Validation

### Task 15: i18n — 4 Languages

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/tr.json`
- Modify: `src/i18n/locales/es.json`
- Modify: `src/i18n/locales/de.json`

- [ ] **Step 15.1: Add keys to en.json**

In `src/i18n/locales/en.json`, find the `"chat"` object and add the new keys after `"sendMessage"`:

```json
"groups": "Groups",
"noGroups": "No groups yet",
"createGroup": "Create Group Chat",
"groupName": "Group Name",
"groupNamePlaceholder": "Enter group name...",
"addMembers": "Add Members",
"addMember": "Add Member",
"removeMember": "Remove",
"leaveGroup": "Leave Group",
"deleteGroup": "Delete Group",
"manageMembers": "Manage Members",
"members": "Members",
"creator": "Creator",
"creatorLeaveWarning": "You are the creator. Leaving will delete the group for everyone.",
"selectFriends": "Select friends to add",
"atLeastOneMember": "Select at least one friend"
```

- [ ] **Step 15.2: Add keys to tr.json**

In `src/i18n/locales/tr.json`, find the `"chat"` object and add:

```json
"groups": "Gruplar",
"noGroups": "Henüz grup yok",
"createGroup": "Grup Sohbeti Oluştur",
"groupName": "Grup Adı",
"groupNamePlaceholder": "Grup adı girin...",
"addMembers": "Üye Ekle",
"addMember": "Üye Ekle",
"removeMember": "Çıkar",
"leaveGroup": "Gruptan Ayrıl",
"deleteGroup": "Grubu Sil",
"manageMembers": "Üyeleri Yönet",
"members": "Üyeler",
"creator": "Kurucu",
"creatorLeaveWarning": "Siz kurucusunuz. Ayrılırsanız grup herkes için silinir.",
"selectFriends": "Eklenecek arkadaşları seçin",
"atLeastOneMember": "En az bir arkadaş seçin"
```

- [ ] **Step 15.3: Add keys to es.json**

In `src/i18n/locales/es.json`, find the `"chat"` object and add:

```json
"groups": "Grupos",
"noGroups": "Aún no hay grupos",
"createGroup": "Crear chat de grupo",
"groupName": "Nombre del grupo",
"groupNamePlaceholder": "Escribe un nombre...",
"addMembers": "Añadir miembros",
"addMember": "Añadir miembro",
"removeMember": "Expulsar",
"leaveGroup": "Salir del grupo",
"deleteGroup": "Eliminar grupo",
"manageMembers": "Gestionar miembros",
"members": "Miembros",
"creator": "Creador",
"creatorLeaveWarning": "Eres el creador. Si te vas, el grupo se eliminará para todos.",
"selectFriends": "Selecciona amigos para añadir",
"atLeastOneMember": "Selecciona al menos un amigo"
```

- [ ] **Step 15.4: Add keys to de.json**

In `src/i18n/locales/de.json`, find the `"chat"` object and add:

```json
"groups": "Gruppen",
"noGroups": "Noch keine Gruppen",
"createGroup": "Gruppenchat erstellen",
"groupName": "Gruppenname",
"groupNamePlaceholder": "Gruppenname eingeben...",
"addMembers": "Mitglieder hinzufügen",
"addMember": "Mitglied hinzufügen",
"removeMember": "Entfernen",
"leaveGroup": "Gruppe verlassen",
"deleteGroup": "Gruppe löschen",
"manageMembers": "Mitglieder verwalten",
"members": "Mitglieder",
"creator": "Ersteller",
"creatorLeaveWarning": "Du bist der Ersteller. Wenn du gehst, wird die Gruppe für alle gelöscht.",
"selectFriends": "Freunde zum Hinzufügen auswählen",
"atLeastOneMember": "Wähle mindestens einen Freund aus"
```

- [ ] **Step 15.5: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 15.6: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat: add group chat i18n keys for EN, TR, ES, DE"
```

---

### Task 16: Final End-to-End Validation

- [ ] **Step 16.1: Full TypeScript check (both frontend and server)**

```bash
npx tsc --noEmit
cd server && npx tsc --noEmit
```

Expected: 0 errors in both.

- [ ] **Step 16.2: Smoke test — Group creation**

1. Open app, log in as User A
2. Open ChatPanel (click "Friends & Chat" bar)
3. Right-click a friend → "Grup Sohbeti Oluştur"
4. Modal opens → enter group name → check the friend → click Create
5. New group appears in "GRUPLAR" section

- [ ] **Step 16.3: Smoke test — Group messaging**

1. Click the group → GroupChatView opens (left panel)
2. Type a message → send → message appears
3. Log in as the added friend in another window → group appears in their list too
4. Send a message from friend → real-time delivery to User A

- [ ] **Step 16.4: Smoke test — Member management**

1. Click ⚙️ → member list shows
2. Creator: kick a member → they disappear from list
3. Click "Gruptan Ayrıl" → leave group → returns to friends panel

- [ ] **Step 16.5: Smoke test — DM still works**

1. Click a friend directly → DM chat opens (not group view)
2. Send a DM → works as before
3. Accordion animation still works correctly

- [ ] **Step 16.6: Final commit**

```bash
git add -A
git commit -m "feat: group chat — complete implementation"
```
