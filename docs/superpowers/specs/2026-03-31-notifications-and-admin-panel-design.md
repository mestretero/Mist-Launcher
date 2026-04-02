# Notification System Redesign + Admin Panel — Design Spec

## Part 1: Notification System Redesign

### Problem
- Current system polls every 30 seconds — notifications arrive late
- Hardcoded Turkish strings in `NotificationPanel.tsx`
- No WS push despite WS infrastructure being available (`sendToUser` in gateway.ts)
- Notifications accumulate forever in DB (no expiration)

### Architecture
Replace polling with WebSocket push. When `createNotification` is called server-side, it immediately pushes to the client via `sendToUser`. Client stores update in real-time. Badge count updates instantly. No toast popups — just badge.

### Changes

**Server:**

1. **`server/src/services/notification.service.ts`**
   - `createNotification()` — after DB insert, call `sendToUser(userId, { type: "notification:new", payload: notification })` (lazy import gateway to avoid circular deps)
   - Add `cleanupExpiredNotifications()` — delete notifications older than 24 hours
   - Keep existing `getNotifications`, `markAsRead`, `markAllAsRead` unchanged

2. **`server/src/lib/scheduler.ts`** (new file)
   - Create a cleanup scheduler that runs every 30 minutes
   - Calls `cleanupOldMessages()` from dm.service, `cleanupOldMessages()` from group.service, and `cleanupExpiredNotifications()` from notification.service
   - Started from `server/src/index.ts` after app starts
   - Note: `cleanupOldMessages` functions exist but are never invoked on a timer — this fixes that too

**Client:**

3. **`src/stores/notificationStore.ts`**
   - Remove `startPolling`, `stopPolling`, `pollInterval`
   - Keep `fetch()` for initial load on app start (one-time)
   - Add `receiveNotification(notification)` — prepend to list, increment unreadCount
   - Keep `markRead`, `markAllRead` unchanged

4. **`src/stores/roomStore.ts`**
   - Add `case "notification:new":` in WS message handler
   - Dynamic import `notificationStore`, call `receiveNotification(payload)`

5. **`src/components/NotificationPanel.tsx`**
   - Replace hardcoded "Bildirimler" → `t("notifications.title")`
   - Replace "Tumunu Okundu Isaretle" → `t("notifications.markAllRead")`
   - Replace "Bildirim yok" → `t("notifications.empty")`
   - Replace "Az once" etc. → use i18n key-based timeAgo helper (custom function using `t("time.minutesAgo", { count })`, `t("time.hoursAgo", { count })`, etc.)

6. **i18n locales (en, tr, es, de)**
   - Add `notifications.markAllRead` key
   - Add `time.justNow`, `time.minutesAgo`, `time.hoursAgo`, `time.daysAgo` keys
   - Existing keys: `notifications.title`, `notifications.empty`, `notifications.unread` are already there

---

## Part 2: Admin Panel

### Problem
- No way to manage users (view, ban, unban)
- No way to view reported users or reported community links
- Existing admin routes only handle Steam/IGDB game sync — and lack admin authorization (any authenticated user can call them)
- No user reporting system exists (only `CommunityLinkReport` model)

### Access Control
- Navbar shows "Admin" tab only when `user.isAdmin === true`
- All `/admin/*` endpoints use a `preHandler` hook that checks `isAdmin`, returns 404 (not 403) if not admin
- This hook replaces the current lack of admin auth on existing Steam/IGDB sync routes too
- Normal users never see any trace of admin functionality

### Database Changes

**New fields on `User` model:**
```prisma
isBanned    Boolean   @default(false) @map("is_banned")
bannedAt    DateTime? @map("banned_at")
```

**New enum:**
```prisma
enum ReportStatus {
  OPEN
  RESOLVED
  DISMISSED
}
```

**New model: `UserReport`**
```prisma
model UserReport {
  id             String       @id @default(uuid()) @db.Uuid
  reporterId     String       @map("reporter_id") @db.Uuid
  reportedUserId String       @map("reported_user_id") @db.Uuid
  reason         String       @db.VarChar(500)
  status         ReportStatus @default(OPEN)
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  reporter       User         @relation("ReportsBy", fields: [reporterId], references: [id])
  reportedUser   User         @relation("ReportsAgainst", fields: [reportedUserId], references: [id])

  @@unique([reporterId, reportedUserId])
  @@index([reportedUserId])
  @@index([status])
  @@map("user_reports")
}
```

Back-relations on User:
```prisma
reportsMade     UserReport[] @relation("ReportsBy")
reportsReceived UserReport[] @relation("ReportsAgainst")
```

### Ban Enforcement

**Multi-layer ban checks:**
1. **`auth.service.ts` → `loginUser()`** — reject login if `isBanned`
2. **`auth.service.ts` → `refreshTokens()`** — reject token refresh if `isBanned` (ensures ban takes effect within access token TTL)
3. **`admin.service.ts` → `banUser()`** — after setting `isBanned: true`, close the user's active WS connection via `getClient(userId)?.ws.close(4004, "Account banned")` from gateway.ts
4. Tradeoff: We don't add per-request ban checks (too expensive). Ban takes effect immediately for WS, and within access token TTL for REST calls.

### Backend

**`server/src/services/admin.service.ts`** (new file)
- `listUsers(search?, page, limit)` — paginated user list with optional search by username/email
- `banUser(userId)` — set `isBanned: true, bannedAt: now()`, close WS connection
- `unbanUser(userId)` — set `isBanned: false, bannedAt: null`
- `getReportedUsers(page, limit)` — users with OPEN reports, grouped by reportedUserId, sorted by report count desc
- `getUserReports(userId)` — all reports for a specific user
- `resolveReport(reportId, status)` — mark report as RESOLVED or DISMISSED
- `getReportedLinks(page, limit)` — community links with reports count > 0, sorted by report count desc. Note: `CommunityLinkReport` has no `reason` field — admin panel shows only report count, not reasons.
- `hideCommunityLink(linkId)` — set `isHidden: true` (reuse existing `communityLink.service` if available)
- `deleteCommunityLink(linkId)` — cascade delete (Prisma onDelete: Cascade handles mirrors/votes/reports)
- `getDashboardStats()` — total users, banned count, open reports count, reported links count

**`server/src/routes/admin.ts`** (extend existing)
- Add admin-only `preHandler` hook at route plugin level: `app.addHook("preHandler", (req, reply, done) => { if (!req.user?.isAdmin) { reply.status(404).send({ error: { message: "Not found" } }); return; } done(); })`
- This secures existing Steam/IGDB sync routes too
- New endpoints:
  - `GET /admin/users?search=&page=1&limit=20`
  - `POST /admin/users/:id/ban`
  - `POST /admin/users/:id/unban`
  - `GET /admin/reported-users?page=1&limit=20`
  - `GET /admin/reported-users/:id/reports`
  - `PATCH /admin/reports/:id` (body: { status: "RESOLVED" | "DISMISSED" })
  - `GET /admin/reported-links?page=1&limit=20`
  - `POST /admin/links/:id/hide`
  - `DELETE /admin/links/:id`
  - `GET /admin/stats`

**`server/src/services/auth.service.ts`**
- In `loginUser()`, after password verify: check `if (user.isBanned) throw unauthorized("Account banned")`
- In `refreshTokens()`, after user lookup: check `if (user.isBanned) throw unauthorized("Account banned")`

### Frontend

**`src/lib/api.ts`**
- Add `admin` namespace with methods matching all endpoints above

**`src/pages/AdminPage.tsx`** (new)
- 3 tabs: Users, Reported Users, Reported Links
- Stats bar at top (total users, banned, open reports, reported links)
- Each tab has search/pagination
- Users tab: table with username, email, createdAt, status badge (active/banned), ban/unban button
- Reported Users tab: cards showing user + report count + latest reason, action buttons (view reports, ban, dismiss all)
- Reported Links tab: cards showing link title + game + report count (no reasons — CommunityLinkReport has no reason field), action buttons (hide, delete)

**`src/components/Navbar.tsx`** (or wherever nav lives)
- Add admin link: `{user?.isAdmin && <NavItem icon={ShieldIcon} label="Admin" page="admin" />}`

**`src/App.tsx`** (or router)
- Add `case "admin":` → render `<AdminPage />`

### User Reporting
- On user profile pages, add "Report User" button (not visible on own profile)
- Opens modal with reason textarea
- `POST /users/:id/report` endpoint (non-admin route, any authenticated user)
- Creates `UserReport` record
- `@@unique([reporterId, reportedUserId])` ensures one report per reporter-target pair
- If user already reported, show "Already reported" state

---

## Shared i18n Keys Needed

### Notifications
- `notifications.markAllRead` — EN: "Mark all as read", TR: "Tümünü okundu işaretle", ES: "Marcar todo como leído", DE: "Alle als gelesen markieren"

### Time (for i18n-aware timeAgo)
- `time.justNow` — EN: "Just now", TR: "Az önce", ES: "Ahora", DE: "Gerade"
- `time.minutesAgo` — EN: "{{count}}m ago", TR: "{{count}}dk önce", ES: "hace {{count}}m", DE: "vor {{count}}m"
- `time.hoursAgo` — EN: "{{count}}h ago", TR: "{{count}}sa önce", ES: "hace {{count}}h", DE: "vor {{count}}h"
- `time.daysAgo` — EN: "{{count}}d ago", TR: "{{count}}g önce", ES: "hace {{count}}d", DE: "vor {{count}}T"

### Admin Panel
- `admin.title` — "Admin Panel"
- `admin.users` — "Users"
- `admin.reportedUsers` — "Reported Users"
- `admin.reportedLinks` — "Reported Links"
- `admin.search` — "Search..."
- `admin.ban` — "Ban"
- `admin.unban` — "Unban"
- `admin.banned` — "Banned"
- `admin.active` — "Active"
- `admin.hide` — "Hide"
- `admin.delete` — "Delete"
- `admin.resolve` — "Resolve"
- `admin.dismiss` — "Dismiss"
- `admin.viewReports` — "View Reports"
- `admin.stats` — "Dashboard"
- `admin.totalUsers` — "Total Users"
- `admin.bannedUsers` — "Banned Users"
- `admin.openReports` — "Open Reports"
- `admin.reportedLinksCount` — "Reported Links"
- `admin.noResults` — "No results"
- `admin.reportReason` — "Reason"
- `admin.reportDate` — "Date"
- `admin.confirmBan` — "Ban this user?"
- `admin.confirmDelete` — "Delete this link permanently?"
