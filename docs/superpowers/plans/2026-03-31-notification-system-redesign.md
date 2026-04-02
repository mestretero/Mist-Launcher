# Notification System Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 30-second polling with WebSocket push so notifications arrive instantly, add a cleanup scheduler to expire notifications after 24 hours, and fix hardcoded Turkish strings with proper i18n keys.

**Architecture:** The server's `createNotification()` now pushes via `sendToUser` immediately after DB insert. The client removes all polling logic and instead handles a new `notification:new` WS event in `roomStore.ts`. A new `scheduler.ts` runs cleanup tasks every 30 minutes.

**Tech Stack:** Fastify 5, Prisma 7, TypeScript, Zustand, react-i18next, @fastify/websocket

---

## Chunk 1: Server — cleanup scheduler + WS push

### Task 1: Create cleanup scheduler

**Files:**
- Create: `server/src/lib/scheduler.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create `server/src/lib/scheduler.ts`**

```typescript
// server/src/lib/scheduler.ts
export function startScheduler() {
  const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  async function runCleanup() {
    try {
      const { cleanupOldMessages } = await import("../services/dm.service.js");
      await cleanupOldMessages();
    } catch (e) {
      console.error("DM cleanup error:", e);
    }
    try {
      const { cleanupOldMessages: cleanupGroupMessages } = await import("../services/group.service.js");
      await cleanupGroupMessages();
    } catch (e) {
      console.error("Group message cleanup error:", e);
    }
    try {
      const { cleanupExpiredNotifications } = await import("../services/notification.service.js");
      await cleanupExpiredNotifications();
    } catch (e) {
      console.error("Notification cleanup error:", e);
    }
  }

  // Run once immediately on startup
  runCleanup();
  // Then every 30 minutes
  const interval = setInterval(runCleanup, INTERVAL_MS);
  return interval;
}
```

- [ ] **Step 2: Wire scheduler into `server/src/index.ts`**

Current content of `server/src/index.ts`:
```typescript
import "dotenv/config";
import { buildApp } from "./app.js";
import { cleanupStaleRooms } from "./services/room.service.js";

const start = async () => {
  const app = await buildApp();
  await app.listen({ port: 3001, host: "0.0.0.0" });
  await cleanupStaleRooms();
};

start();
```

Change to:
```typescript
import "dotenv/config";
import { buildApp } from "./app.js";
import { cleanupStaleRooms } from "./services/room.service.js";
import { startScheduler } from "./lib/scheduler.js";

const start = async () => {
  const app = await buildApp();
  await app.listen({ port: 3001, host: "0.0.0.0" });
  await cleanupStaleRooms();
  startScheduler();
};

start();
```

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/scheduler.ts server/src/index.ts
git commit -m "feat: add cleanup scheduler for messages and notifications"
```

---

### Task 2: Add WS push and 24h cleanup to notification service

**Files:**
- Modify: `server/src/services/notification.service.ts`

Current full content of `server/src/services/notification.service.ts`:
```typescript
import { prisma } from "../lib/prisma.js";
import type { NotificationType } from "@prisma/client";

export async function createNotification(userId: string, type: NotificationType, title: string, message: string, data: any = {}) {
  return prisma.notification.create({
    data: { userId, type, title, message, data },
  });
}

export async function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markAsRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
```

Replace the entire file with:
```typescript
import { prisma } from "../lib/prisma.js";
import type { NotificationType } from "@prisma/client";

export async function createNotification(userId: string, type: NotificationType, title: string, message: string, data: any = {}) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, message, data },
  });
  // Push to client in real-time via WebSocket (lazy import to avoid circular deps)
  try {
    const { sendToUser } = await import("../ws/gateway.js");
    sendToUser(userId, { type: "notification:new", payload: notification });
  } catch { /* WS not available — silent fail */ }
  return notification;
}

export async function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markAsRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function cleanupExpiredNotifications() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.notification.deleteMany({
    where: { createdAt: { lt: oneDayAgo } },
  });
  if (result.count > 0) console.log(`Cleaned up ${result.count} expired notifications`);
}
```

- [ ] **Step 4: Commit**

```bash
git add server/src/services/notification.service.ts
git commit -m "feat: push notifications via WebSocket + 24h auto-cleanup"
```

---

## Chunk 2: Client — remove polling, handle WS push, fix i18n

### Task 3: Replace polling with WS-driven store

**Files:**
- Modify: `src/stores/notificationStore.ts`
- Modify: `src/App.tsx`

- [ ] **Step 5: Rewrite `src/stores/notificationStore.ts`**

Replace entire file with:
```typescript
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
  receiveNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetch: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const token = await invoke<string | null>("get_token", { key: "access_token" });
      if (!token) return;
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

  receiveNotification: (notification) => {
    set((s) => ({
      notifications: [notification, ...s.notifications].slice(0, 50),
      unreadCount: s.unreadCount + 1,
    }));
  },
}));
```

- [ ] **Step 6: Remove polling calls in `src/App.tsx`**

In `src/App.tsx`, find the `useEffect` that calls `startPolling` and `stopPolling`:

```typescript
  useEffect(() => {
    if (isAuthenticated) {
      useNotificationStore.getState().startPolling();
      // ...
    }
    return () => { useNotificationStore.getState().stopPolling(); };
  }, [isAuthenticated]);
```

Change to call `fetch()` once instead of starting polling:
```typescript
  useEffect(() => {
    if (isAuthenticated) {
      useNotificationStore.getState().fetch();
      useCartStore.getState().fetch();
      // Connect WebSocket for multiplayer
      import("./lib/api").then(({ getAccessToken }) => {
        getAccessToken().then((token) => {
          if (token) {
            import("./stores/roomStore").then(({ useRoomStore }) => {
              useRoomStore.getState().connect(token);
            });
          }
        });
      }).catch(() => {});
      // Sync local games to server for profile display
      import("./stores/localGameStore").then(({ useLocalGameStore }) => {
        useLocalGameStore.getState().loadGames().then(() => {
          useLocalGameStore.getState().syncToServer();
        });
      }).catch(() => {});
    } else {
      // Disconnect WebSocket on logout
      import("./stores/roomStore").then(({ useRoomStore }) => {
        useRoomStore.getState().disconnect();
      }).catch(() => {});
    }
  }, [isAuthenticated]);
```

- [ ] **Step 7: Commit**

```bash
git add src/stores/notificationStore.ts src/App.tsx
git commit -m "feat: replace notification polling with one-time fetch + WS push"
```

---

### Task 4: Handle `notification:new` WS event in roomStore

**Files:**
- Modify: `src/stores/roomStore.ts`

- [ ] **Step 8: Add `notification:new` case to WS message handler**

In `src/stores/roomStore.ts`, find the `case "group:created":` block (around line 347-351):
```typescript
    case "group:created":
      import("./groupStore").then(({ useGroupStore }) => {
        useGroupStore.getState().receiveGroupCreated(payload as any);
      });
      break;
```

Add the new case AFTER it (before `case "error":`):
```typescript
    case "notification:new":
      import("./notificationStore").then(({ useNotificationStore }) => {
        useNotificationStore.getState().receiveNotification(payload as any);
      });
      break;
```

- [ ] **Step 9: Commit**

```bash
git add src/stores/roomStore.ts
git commit -m "feat: handle notification:new WS event in roomStore"
```

---

### Task 5: Add i18n keys for notifications and time

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/tr.json`
- Modify: `src/i18n/locales/es.json`
- Modify: `src/i18n/locales/de.json`

- [ ] **Step 10: Add keys to `src/i18n/locales/en.json`**

Find the `"notifications"` object (currently has `title`, `empty`, `unread`) and add `markAllRead`:
```json
"notifications": {
  "title": "Notifications",
  "empty": "No new notifications",
  "unread": "{{count}} unread notifications",
  "markAllRead": "Mark all as read"
},
```

Also add a new top-level `"time"` object anywhere in the file:
```json
"time": {
  "justNow": "Just now",
  "minutesAgo": "{{count}}m ago",
  "hoursAgo": "{{count}}h ago",
  "daysAgo": "{{count}}d ago"
},
```

- [ ] **Step 11: Add keys to `src/i18n/locales/tr.json`**

```json
"notifications": {
  "title": "Bildirimler",
  "empty": "Yeni bildirim yok",
  "unread": "{{count}} okunmamış bildirim",
  "markAllRead": "Tümünü okundu işaretle"
},
"time": {
  "justNow": "Az önce",
  "minutesAgo": "{{count}}dk önce",
  "hoursAgo": "{{count}}sa önce",
  "daysAgo": "{{count}}g önce"
},
```

- [ ] **Step 12: Add keys to `src/i18n/locales/es.json`**

```json
"notifications": {
  "title": "Notificaciones",
  "empty": "No hay notificaciones nuevas",
  "unread": "{{count}} notificaciones no leídas",
  "markAllRead": "Marcar todo como leído"
},
"time": {
  "justNow": "Ahora mismo",
  "minutesAgo": "hace {{count}}m",
  "hoursAgo": "hace {{count}}h",
  "daysAgo": "hace {{count}}d"
},
```

- [ ] **Step 13: Add keys to `src/i18n/locales/de.json`**

```json
"notifications": {
  "title": "Benachrichtigungen",
  "empty": "Keine neuen Benachrichtigungen",
  "unread": "{{count}} ungelesene Benachrichtigungen",
  "markAllRead": "Alle als gelesen markieren"
},
"time": {
  "justNow": "Gerade eben",
  "minutesAgo": "vor {{count}}m",
  "hoursAgo": "vor {{count}}h",
  "daysAgo": "vor {{count}}T"
},
```

- [ ] **Step 14: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/tr.json src/i18n/locales/es.json src/i18n/locales/de.json
git commit -m "i18n: add notifications.markAllRead and time.* keys for all locales"
```

---

### Task 6: Fix hardcoded strings in NotificationPanel

**Files:**
- Modify: `src/components/NotificationPanel.tsx`

- [ ] **Step 15: Rewrite NotificationPanel with i18n and timeAgo helper**

Replace the entire `NotificationPanel.tsx` with:

```typescript
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNotificationStore } from "../stores/notificationStore";

interface NotificationPanelProps {
  onClose: () => void;
}

function timeAgo(dateStr: string, t: (key: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("time.daysAgo", { count: days });
  return new Date(dateStr).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function NotificationIcon({ type }: { type: string }) {
  const className = "w-4 h-4";
  if (type === "PAYMENT_SUCCESS") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    );
  }
  if (type === "FRIEND_REQUEST" || type === "FRIEND_ACCEPTED") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    );
  }
  if (type === "WISHLIST_SALE") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { t } = useTranslation();
  const { notifications, markRead, markAllRead } = useNotificationStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const panel = document.getElementById("notification-panel");
      if (panel && !panel.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => window.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(timer); window.removeEventListener("mousedown", handler); };
  }, [onClose]);

  return (
    <div
      id="notification-panel"
      className="absolute right-0 top-full mt-2 w-80 bg-brand-900 border border-brand-800 rounded shadow-2xl z-50 font-sans"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-800">
        <h3 className="text-xs font-black uppercase tracking-widest text-brand-200">
          {t("notifications.title")}
        </h3>
        <button
          onClick={() => markAllRead()}
          className="text-[10px] font-bold uppercase tracking-widest text-brand-500 hover:text-brand-200 transition-colors cursor-pointer"
        >
          {t("notifications.markAllRead")}
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="text-center py-10">
            <svg className="mx-auto mb-2 text-brand-700" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-xs font-bold text-brand-500 uppercase tracking-widest">
              {t("notifications.empty")}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => { if (!notification.isRead) markRead(notification.id); }}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-brand-800/50 transition-colors hover:bg-brand-800/50 cursor-pointer ${
                !notification.isRead ? "bg-brand-950/50" : ""
              }`}
            >
              <div className="w-8 h-8 rounded flex items-center justify-center bg-brand-950 border border-brand-800 flex-shrink-0 mt-0.5 text-brand-400">
                <NotificationIcon type={notification.type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-brand-100 truncate">{notification.title}</p>
                  {!notification.isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-brand-400 leading-relaxed mt-0.5 line-clamp-2">
                  {notification.message}
                </p>
                <p className="text-[10px] text-brand-600 font-medium mt-1">
                  {timeAgo(notification.createdAt, t)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 16: Commit**

```bash
git add src/components/NotificationPanel.tsx
git commit -m "feat: i18n NotificationPanel + i18n-aware timeAgo helper"
```
