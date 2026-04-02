# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only panel with user management (list, search, ban/unban), reported user management, and reported community link management, accessible only via a nav tab visible to admin users.

**Architecture:** New DB fields (`isBanned` on User) + new model (`UserReport`) via Prisma migration. New `admin.service.ts` with all query/mutation logic. Extended `admin.ts` routes with a plugin-level admin guard (404 for non-admins). New `AdminPage.tsx` with 3 tabs. Admin tab added to `TopBar.tsx` nav items, visible only when `user.isAdmin`.

**Tech Stack:** Fastify 5, Prisma 7, PostgreSQL, TypeScript, React 19, Zustand, Tailwind CSS

---

## Chunk 1: Database migration

### Task 1: Add isBanned to User and create UserReport model

**Files:**
- Modify: `server/prisma/schema.prisma`
- Run: `npx prisma migrate dev`

- [ ] **Step 1: Add new fields and model to `server/prisma/schema.prisma`**

In the `User` model (around line 152, after `isAdmin` field), add:
```prisma
  isBanned            Boolean       @default(false) @map("is_banned")
  bannedAt            DateTime?     @map("banned_at")
```

Also add two back-relations to User (after `sentGroupMessages` line ~186):
```prisma
  reportsMade         UserReport[]  @relation("ReportsBy")
  reportsReceived     UserReport[]  @relation("ReportsAgainst")
```

Add the new enum after the existing enums (e.g., after `VoteType`):
```prisma
enum ReportStatus {
  OPEN
  RESOLVED
  DISMISSED
}
```

Add the new model (e.g., after `CommunityLinkReport` model, around line 655):
```prisma
// ─── User Reports ────────────────────────────────
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

- [ ] **Step 2: Run migration**

```bash
cd server
npx prisma migrate dev --name add_ban_and_user_reports
```

Expected output: Migration created and applied. Prisma Client regenerated.

- [ ] **Step 3: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat: add isBanned to User + UserReport model"
```

---

## Chunk 2: Backend — admin service and routes

### Task 2: Create admin.service.ts

**Files:**
- Create: `server/src/services/admin.service.ts`

- [ ] **Step 4: Create `server/src/services/admin.service.ts`**

```typescript
// server/src/services/admin.service.ts
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";
import { getClient } from "../ws/gateway.js";

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  isAdmin: true,
  isBanned: true,
  bannedAt: true,
  createdAt: true,
};

export async function listUsers(search: string | undefined, page: number, limit: number) {
  const where = search
    ? {
        OR: [
          { username: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit };
}

export async function banUser(targetId: string) {
  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw notFound("User not found");

  await prisma.user.update({
    where: { id: targetId },
    data: { isBanned: true, bannedAt: new Date() },
  });

  // Kick the user's active WebSocket connection immediately
  try {
    const client = getClient(targetId);
    if (client) client.ws.close(4004, "Account banned");
  } catch { /* WS client may not be connected */ }

  return { success: true };
}

export async function unbanUser(targetId: string) {
  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw notFound("User not found");

  await prisma.user.update({
    where: { id: targetId },
    data: { isBanned: false, bannedAt: null },
  });

  return { success: true };
}

export async function getReportedUsers(page: number, limit: number) {
  // Group user reports by reportedUserId, count them, return users with OPEN reports
  const grouped = await prisma.userReport.groupBy({
    by: ["reportedUserId"],
    where: { status: "OPEN" },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    skip: (page - 1) * limit,
    take: limit,
  });

  const userIds = grouped.map((g) => g.reportedUserId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { ...USER_SELECT, reportsReceived: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 1, select: { reason: true, createdAt: true } } },
  });

  // Merge count into user objects
  const countMap = new Map(grouped.map((g) => [g.reportedUserId, g._count.id]));
  const result = users.map((u) => ({
    ...u,
    openReportCount: countMap.get(u.id) ?? 0,
    latestReason: u.reportsReceived[0]?.reason ?? null,
    latestReportAt: u.reportsReceived[0]?.createdAt ?? null,
    reportsReceived: undefined,
  }));

  const total = await prisma.userReport.groupBy({ by: ["reportedUserId"], where: { status: "OPEN" } }).then((r) => r.length);

  return { users: result, total, page, limit };
}

export async function getUserReports(userId: string) {
  return prisma.userReport.findMany({
    where: { reportedUserId: userId },
    include: { reporter: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveReport(reportId: string, status: "RESOLVED" | "DISMISSED") {
  const report = await prisma.userReport.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("Report not found");

  return prisma.userReport.update({
    where: { id: reportId },
    data: { status },
  });
}

export async function getReportedLinks(page: number, limit: number) {
  // Community links with at least 1 report
  const links = await prisma.communityLink.findMany({
    where: { virusReports: { gt: 0 } },
    include: {
      user: { select: { id: true, username: true } },
      game: { select: { id: true, title: true, slug: true } },
      mirrors: { select: { id: true, sourceName: true, url: true } },
      reports: { select: { id: true, userId: true, createdAt: true } },
    },
    orderBy: { virusReports: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.communityLink.count({ where: { virusReports: { gt: 0 } } });

  return { links, total, page, limit };
}

export async function hideCommunityLink(linkId: string) {
  const link = await prisma.communityLink.findUnique({ where: { id: linkId } });
  if (!link) throw notFound("Link not found");

  return prisma.communityLink.update({
    where: { id: linkId },
    data: { isHidden: true },
  });
}

export async function deleteCommunityLink(linkId: string) {
  const link = await prisma.communityLink.findUnique({ where: { id: linkId } });
  if (!link) throw notFound("Link not found");

  await prisma.communityLink.delete({ where: { id: linkId } });
  return { success: true };
}

export async function getDashboardStats() {
  const [totalUsers, bannedUsers, openReports, reportedLinks] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.userReport.count({ where: { status: "OPEN" } }),
    prisma.communityLink.count({ where: { virusReports: { gt: 0 } } }),
  ]);

  return { totalUsers, bannedUsers, openReports, reportedLinks };
}
```

- [ ] **Step 5: Commit**

```bash
git add server/src/services/admin.service.ts
git commit -m "feat: admin.service.ts with user/report/link management"
```

---

### Task 3: Extend admin routes + add ban checks to auth service

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/services/auth.service.ts`

- [ ] **Step 6: Rewrite `server/src/routes/admin.ts`**

Replace the entire file with:

```typescript
import { FastifyInstance } from "fastify";
import * as igdbService from "../services/igdb.service.js";
import * as steamService from "../services/steam.service.js";
import * as adminService from "../services/admin.service.js";

export default async function adminRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook("preHandler", app.authenticate);
  // Admin-only guard — returns 404 (not 403) to avoid revealing panel exists
  app.addHook("preHandler", async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.status(404).send({ error: { message: "Not found" } });
    }
  });

  // ── Steam / IGDB sync (existing) ──────────────────────
  app.post("/admin/igdb/sync", async (request) => {
    const { mode = "popular", limit = 50 } = request.body as { mode?: string; limit?: number };
    const result = await igdbService.syncGamesFromIGDB({ mode: mode as any, limit: Math.min(limit, 100) });
    return { data: result };
  });

  app.post("/admin/steam/sync-most-played", async (request) => {
    const { limit = 100 } = request.body as { limit?: number };
    const result = await steamService.syncMostPlayed(Math.min(limit, 200));
    return { data: result };
  });

  app.post("/admin/steam/sync-featured", async () => {
    const result = await steamService.syncTopSellers();
    return { data: result };
  });

  app.post("/admin/steam/sync-aaa", async () => {
    const unique = [...new Set(steamService.AAA_APPIDS)];
    const result = await steamService.syncByAppIds(unique);
    return { data: result };
  });

  app.post("/admin/steam/sync-all", async () => {
    console.log("Starting full Steam sync...");
    const aaa = await steamService.syncByAppIds([...new Set(steamService.AAA_APPIDS)]);
    const mostPlayed = await steamService.syncMostPlayed(100);
    const featured = await steamService.syncTopSellers();
    return { data: { aaa, mostPlayed, featured, totalAdded: aaa.added + mostPlayed.added + featured.added } };
  });

  // ── Dashboard stats ───────────────────────────────────
  app.get("/admin/stats", async () => {
    const stats = await adminService.getDashboardStats();
    return { data: stats };
  });

  // ── User management ───────────────────────────────────
  app.get("/admin/users", async (request) => {
    const { search, page = "1", limit = "20" } = request.query as { search?: string; page?: string; limit?: string };
    const result = await adminService.listUsers(search, parseInt(page), parseInt(limit));
    return { data: result };
  });

  app.post("/admin/users/:id/ban", async (request) => {
    const { id } = request.params as { id: string };
    const result = await adminService.banUser(id);
    return { data: result };
  });

  app.post("/admin/users/:id/unban", async (request) => {
    const { id } = request.params as { id: string };
    const result = await adminService.unbanUser(id);
    return { data: result };
  });

  // ── Reported users ────────────────────────────────────
  app.get("/admin/reported-users", async (request) => {
    const { page = "1", limit = "20" } = request.query as { page?: string; limit?: string };
    const result = await adminService.getReportedUsers(parseInt(page), parseInt(limit));
    return { data: result };
  });

  app.get("/admin/reported-users/:id/reports", async (request) => {
    const { id } = request.params as { id: string };
    const reports = await adminService.getUserReports(id);
    return { data: reports };
  });

  app.patch("/admin/reports/:id", async (request) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: "RESOLVED" | "DISMISSED" };
    const result = await adminService.resolveReport(id, status);
    return { data: result };
  });

  // ── Reported community links ──────────────────────────
  app.get("/admin/reported-links", async (request) => {
    const { page = "1", limit = "20" } = request.query as { page?: string; limit?: string };
    const result = await adminService.getReportedLinks(parseInt(page), parseInt(limit));
    return { data: result };
  });

  app.post("/admin/links/:id/hide", async (request) => {
    const { id } = request.params as { id: string };
    const result = await adminService.hideCommunityLink(id);
    return { data: result };
  });

  app.delete("/admin/links/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await adminService.deleteCommunityLink(id);
    return reply.status(204).send();
  });
}
```

- [ ] **Step 7: Add ban checks to `server/src/services/auth.service.ts`**

In `loginUser()` (around line 76, after `if (!valid)`), add ban check:
```typescript
  if (user.isBanned) throw unauthorized("This account has been banned");
```

In `refreshTokens()` (around line 124, after user lookup), change:
```typescript
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { isAdmin: true } });
  return createTokens(payload.userId, payload.email, user?.isAdmin ?? false);
```
To:
```typescript
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { isAdmin: true, isBanned: true } });
  if (user?.isBanned) throw unauthorized("This account has been banned");
  return createTokens(payload.userId, payload.email, user?.isAdmin ?? false);
```

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/admin.ts server/src/services/auth.service.ts
git commit -m "feat: admin routes with guard + ban enforcement in auth"
```

---

## Chunk 3: Frontend — API, page, and nav

### Task 4: Add admin namespace to api.ts

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 9: Add admin API methods to `src/lib/api.ts`**

At the end of the `api` object (after the `groups` namespace, before the closing `}`), add:

```typescript
  admin: {
    stats: () =>
      request<{ totalUsers: number; bannedUsers: number; openReports: number; reportedLinks: number }>("/admin/stats"),
    listUsers: (search?: string, page = 1, limit = 20) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      return request<{ users: any[]; total: number; page: number; limit: number }>(`/admin/users?${params}`);
    },
    banUser: (id: string) => request<{ success: boolean }>(`/admin/users/${id}/ban`, { method: "POST" }),
    unbanUser: (id: string) => request<{ success: boolean }>(`/admin/users/${id}/unban`, { method: "POST" }),
    reportedUsers: (page = 1, limit = 20) =>
      request<{ users: any[]; total: number }>(`/admin/reported-users?page=${page}&limit=${limit}`),
    getUserReports: (userId: string) =>
      request<any[]>(`/admin/reported-users/${userId}/reports`),
    resolveReport: (reportId: string, status: "RESOLVED" | "DISMISSED") =>
      request<any>(`/admin/reports/${reportId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    reportedLinks: (page = 1, limit = 20) =>
      request<{ links: any[]; total: number }>(`/admin/reported-links?page=${page}&limit=${limit}`),
    hideLink: (linkId: string) =>
      request<any>(`/admin/links/${linkId}/hide`, { method: "POST" }),
    deleteLink: (linkId: string) =>
      request<void>(`/admin/links/${linkId}`, { method: "DELETE" }),
  },
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: admin API namespace in api.ts"
```

---

### Task 5: Create AdminPage.tsx

**Files:**
- Create: `src/pages/AdminPage.tsx`

- [ ] **Step 11: Create `src/pages/AdminPage.tsx`**

```typescript
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

type Tab = "users" | "reportedUsers" | "reportedLinks";

export function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("users");
  const [stats, setStats] = useState<{ totalUsers: number; bannedUsers: number; openReports: number; reportedLinks: number } | null>(null);

  useEffect(() => {
    api.admin.stats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-brand-950 text-brand-100 p-6 font-sans">
      <h1 className="text-xl font-black uppercase tracking-widest text-white mb-6">{t("admin.title")}</h1>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: t("admin.totalUsers"), value: stats.totalUsers },
            { label: t("admin.bannedUsers"), value: stats.bannedUsers, red: true },
            { label: t("admin.openReports"), value: stats.openReports, red: stats.openReports > 0 },
            { label: t("admin.reportedLinksCount"), value: stats.reportedLinks, red: stats.reportedLinks > 0 },
          ].map((s) => (
            <div key={s.label} className="bg-brand-900 border border-brand-800 rounded-lg p-4 text-center">
              <p className={`text-2xl font-black ${s.red ? "text-red-400" : "text-white"}`}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-brand-800">
        {([
          { id: "users", label: t("admin.users") },
          { id: "reportedUsers", label: t("admin.reportedUsers") },
          { id: "reportedLinks", label: t("admin.reportedLinks") },
        ] as { id: Tab; label: string }[]).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors cursor-pointer ${
              tab === item.id ? "text-white border-[#1a9fff]" : "text-brand-500 border-transparent hover:text-brand-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab onStatsChange={() => api.admin.stats().then(setStats).catch(() => {})} />}
      {tab === "reportedUsers" && <ReportedUsersTab onStatsChange={() => api.admin.stats().then(setStats).catch(() => {})} />}
      {tab === "reportedLinks" && <ReportedLinksTab onStatsChange={() => api.admin.stats().then(setStats).catch(() => {})} />}
    </div>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────

function UsersTab({ onStatsChange }: { onStatsChange: () => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = 1, q = search) => {
    setLoading(true);
    try {
      const res = await api.admin.listUsers(q || undefined, p, 20);
      setUsers(res.users);
      setTotal(res.total);
      setPage(p);
    } catch {} finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1); }, []);

  async function handleBan(id: string, isBanned: boolean) {
    if (!window.confirm(isBanned ? t("admin.unban") + "?" : t("admin.confirmBan"))) return;
    try {
      if (isBanned) await api.admin.unbanUser(id);
      else await api.admin.banUser(id);
      load(page);
      onStatsChange();
    } catch {}
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") load(1, search); }}
          placeholder={t("admin.search")}
          className="flex-1 px-3 py-2 bg-brand-900 border border-brand-800 rounded text-sm text-brand-100 placeholder:text-brand-600 focus:border-brand-600 outline-none"
        />
        <button onClick={() => load(1, search)} className="px-4 py-2 bg-brand-800 hover:bg-brand-700 rounded text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer">
          Search
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-brand-500 text-sm">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-10 text-brand-500 text-sm">{t("admin.noResults")}</div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-4 px-4 py-3 bg-brand-900 border border-brand-800 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-brand-100 truncate">{user.username}</p>
                <p className="text-xs text-brand-500 truncate">{user.email}</p>
              </div>
              <p className="text-xs text-brand-600 shrink-0">{new Date(user.createdAt).toLocaleDateString()}</p>
              {user.isAdmin && <span className="text-[10px] font-bold px-2 py-0.5 bg-[#1a9fff]/20 text-[#1a9fff] rounded shrink-0">ADMIN</span>}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${user.isBanned ? "bg-red-400/20 text-red-400" : "bg-emerald-400/20 text-emerald-400"}`}>
                {user.isBanned ? t("admin.banned") : t("admin.active")}
              </span>
              {!user.isAdmin && (
                <button
                  onClick={() => handleBan(user.id, user.isBanned)}
                  className={`text-xs px-3 py-1.5 rounded font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                    user.isBanned
                      ? "bg-emerald-400/20 text-emerald-400 hover:bg-emerald-400/30"
                      : "bg-red-400/20 text-red-400 hover:bg-red-400/30"
                  }`}
                >
                  {user.isBanned ? t("admin.unban") : t("admin.ban")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">←</button>
          <span className="text-xs text-brand-500 self-center">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">→</button>
        </div>
      )}
    </div>
  );
}

// ── Reported Users Tab ─────────────────────────────────────────────────────

function ReportedUsersTab({ onStatsChange }: { onStatsChange: () => void }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Record<string, any[]>>({});

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.admin.reportedUsers(p, 20);
      setUsers(res.users);
      setTotal(res.total);
      setPage(p);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, []);

  async function loadReports(userId: string) {
    if (expandedReports[userId]) {
      setExpandedReports((prev) => { const n = { ...prev }; delete n[userId]; return n; });
      return;
    }
    const reports = await api.admin.getUserReports(userId);
    setExpandedReports((prev) => ({ ...prev, [userId]: reports }));
  }

  async function handleBan(userId: string) {
    if (!window.confirm(t("admin.confirmBan"))) return;
    await api.admin.banUser(userId);
    load(page);
    onStatsChange();
  }

  async function handleDismissAll(userId: string, reports: any[]) {
    await Promise.all(reports.map((r) => api.admin.resolveReport(r.id, "DISMISSED")));
    load(page);
    onStatsChange();
  }

  return (
    <div>
      {loading ? (
        <div className="text-center py-10 text-brand-500 text-sm">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-10 text-brand-500 text-sm">{t("admin.noResults")}</div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="bg-brand-900 border border-brand-800 rounded-lg overflow-hidden">
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-brand-100">{user.username}</p>
                  {user.latestReason && <p className="text-xs text-brand-500 truncate mt-0.5">"{user.latestReason}"</p>}
                </div>
                <span className="text-xs font-black text-red-400 shrink-0">{user.openReportCount} {t("admin.openReports")}</span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => loadReports(user.id)} className="text-xs px-3 py-1.5 rounded bg-brand-800 hover:bg-brand-700 transition-colors cursor-pointer">
                    {t("admin.viewReports")}
                  </button>
                  <button onClick={() => handleBan(user.id)} className="text-xs px-3 py-1.5 rounded bg-red-400/20 text-red-400 hover:bg-red-400/30 transition-colors cursor-pointer">
                    {t("admin.ban")}
                  </button>
                </div>
              </div>
              {expandedReports[user.id] && (
                <div className="border-t border-brand-800 px-4 py-3 space-y-2">
                  {expandedReports[user.id].map((r) => (
                    <div key={r.id} className="flex items-start gap-3 text-xs">
                      <span className="text-brand-600 shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                      <span className="text-brand-400 flex-1">{r.reason}</span>
                      <span className="text-brand-600 shrink-0">by {r.reporter.username}</span>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold ${r.status === "OPEN" ? "bg-yellow-400/20 text-yellow-400" : "bg-brand-800 text-brand-500"}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                  <button
                    onClick={() => handleDismissAll(user.id, expandedReports[user.id])}
                    className="text-xs px-3 py-1.5 rounded bg-brand-800 hover:bg-brand-700 transition-colors cursor-pointer mt-2"
                  >
                    {t("admin.dismiss")} All
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">←</button>
          <span className="text-xs text-brand-500 self-center">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">→</button>
        </div>
      )}
    </div>
  );
}

// ── Reported Links Tab ─────────────────────────────────────────────────────

function ReportedLinksTab({ onStatsChange }: { onStatsChange: () => void }) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.admin.reportedLinks(p, 20);
      setLinks(res.links);
      setTotal(res.total);
      setPage(p);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, []);

  async function handleHide(linkId: string) {
    await api.admin.hideLink(linkId);
    load(page);
    onStatsChange();
  }

  async function handleDelete(linkId: string) {
    if (!window.confirm(t("admin.confirmDelete"))) return;
    await api.admin.deleteLink(linkId);
    load(page);
    onStatsChange();
  }

  return (
    <div>
      {loading ? (
        <div className="text-center py-10 text-brand-500 text-sm">Loading...</div>
      ) : links.length === 0 ? (
        <div className="text-center py-10 text-brand-500 text-sm">{t("admin.noResults")}</div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <div key={link.id} className="bg-brand-900 border border-brand-800 rounded-lg px-4 py-3">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-brand-100 truncate">{link.title}</p>
                    {link.isHidden && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-brand-800 text-brand-500 rounded">HIDDEN</span>}
                  </div>
                  <p className="text-xs text-brand-500">
                    {link.game?.title} · by {link.user?.username} · {link.mirrors.length} mirror(s)
                  </p>
                  {link.mirrors.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {link.mirrors.map((m: any) => (
                        <p key={m.id} className="text-[10px] text-brand-600 truncate">{m.sourceName}: {m.url}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs font-black text-red-400">{link.virusReports} {t("admin.openReports")}</span>
                  <div className="flex gap-2">
                    {!link.isHidden && (
                      <button onClick={() => handleHide(link.id)} className="text-xs px-3 py-1.5 rounded bg-brand-800 hover:bg-brand-700 transition-colors cursor-pointer">
                        {t("admin.hide")}
                      </button>
                    )}
                    <button onClick={() => handleDelete(link.id)} className="text-xs px-3 py-1.5 rounded bg-red-400/20 text-red-400 hover:bg-red-400/30 transition-colors cursor-pointer">
                      {t("admin.delete")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">←</button>
          <span className="text-xs text-brand-500 self-center">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">→</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 12: Commit**

```bash
git add src/pages/AdminPage.tsx
git commit -m "feat: AdminPage with users/reported-users/reported-links tabs"
```

---

### Task 6: Add admin nav tab + page route + i18n keys

**Files:**
- Modify: `src/components/TopBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/tr.json`
- Modify: `src/i18n/locales/es.json`
- Modify: `src/i18n/locales/de.json`

- [ ] **Step 13: Add admin to navItems in `src/components/TopBar.tsx`**

Find the `navItems` array (around line 45-52):
```typescript
  const navItems = [
    { id: "store", label: t("nav.store") },
    { id: "library", label: t("nav.library") },
    { id: "collections", label: t("nav.collections") },
    { id: "scanner", label: t("nav.scanner") },
    { id: "multiplayer", label: t("nav.multiplayer") },
    { id: "marketplace", label: t("nav.marketplace") },
  ];
```

Change to:
```typescript
  const navItems = [
    { id: "store", label: t("nav.store") },
    { id: "library", label: t("nav.library") },
    { id: "collections", label: t("nav.collections") },
    { id: "scanner", label: t("nav.scanner") },
    { id: "multiplayer", label: t("nav.multiplayer") },
    { id: "marketplace", label: t("nav.marketplace") },
    ...(user?.isAdmin ? [{ id: "admin", label: t("nav.admin") }] : []),
  ];
```

- [ ] **Step 14: Add admin page route in `src/App.tsx`**

Find the last `{page === ...}` line before `<ToastContainer />` (around line 167):
```typescript
      {page === "user-profile" && gameSlug && (
        <UserProfilePage username={gameSlug} onNavigate={navigate} />
      )}
```

Add after it:
```typescript
      {page === "admin" && <AdminPage />}
```

Also add the import at the top of App.tsx:
```typescript
import { AdminPage } from "./pages/AdminPage";
```

- [ ] **Step 15: Add i18n keys**

In `src/i18n/locales/en.json`, add `"admin": "Admin"` to the `"nav"` object:
```json
"nav": {
  ...
  "admin": "Admin"
}
```

Also add a new top-level `"admin"` object:
```json
"admin": {
  "title": "Admin Panel",
  "users": "Users",
  "reportedUsers": "Reported Users",
  "reportedLinks": "Reported Links",
  "search": "Search...",
  "ban": "Ban",
  "unban": "Unban",
  "banned": "Banned",
  "active": "Active",
  "hide": "Hide",
  "delete": "Delete",
  "resolve": "Resolve",
  "dismiss": "Dismiss",
  "viewReports": "View Reports",
  "stats": "Dashboard",
  "totalUsers": "Total Users",
  "bannedUsers": "Banned Users",
  "openReports": "Open Reports",
  "reportedLinksCount": "Reported Links",
  "noResults": "No results",
  "reportReason": "Reason",
  "reportDate": "Date",
  "confirmBan": "Ban this user?",
  "confirmDelete": "Delete this link permanently?"
}
```

In `src/i18n/locales/tr.json`:
```json
"nav": { ..., "admin": "Admin" }

"admin": {
  "title": "Admin Paneli",
  "users": "Kullanıcılar",
  "reportedUsers": "Şikayet Edilenler",
  "reportedLinks": "Şikayet Edilen Linkler",
  "search": "Ara...",
  "ban": "Yasakla",
  "unban": "Yasağı Kaldır",
  "banned": "Yasaklı",
  "active": "Aktif",
  "hide": "Gizle",
  "delete": "Sil",
  "resolve": "Çöz",
  "dismiss": "Kapat",
  "viewReports": "Şikayetleri Gör",
  "stats": "Özet",
  "totalUsers": "Toplam Kullanıcı",
  "bannedUsers": "Yasaklı Kullanıcı",
  "openReports": "Açık Şikayet",
  "reportedLinksCount": "Şikayet Edilen Link",
  "noResults": "Sonuç bulunamadı",
  "reportReason": "Sebep",
  "reportDate": "Tarih",
  "confirmBan": "Bu kullanıcıyı yasaklamak istiyor musunuz?",
  "confirmDelete": "Bu linki kalıcı olarak silmek istiyor musunuz?"
}
```

In `src/i18n/locales/es.json`:
```json
"nav": { ..., "admin": "Admin" }

"admin": {
  "title": "Panel de Administración",
  "users": "Usuarios",
  "reportedUsers": "Usuarios Reportados",
  "reportedLinks": "Enlaces Reportados",
  "search": "Buscar...",
  "ban": "Banear",
  "unban": "Desbanear",
  "banned": "Baneado",
  "active": "Activo",
  "hide": "Ocultar",
  "delete": "Eliminar",
  "resolve": "Resolver",
  "dismiss": "Descartar",
  "viewReports": "Ver Reportes",
  "stats": "Panel",
  "totalUsers": "Total Usuarios",
  "bannedUsers": "Usuarios Baneados",
  "openReports": "Reportes Abiertos",
  "reportedLinksCount": "Enlaces Reportados",
  "noResults": "Sin resultados",
  "reportReason": "Motivo",
  "reportDate": "Fecha",
  "confirmBan": "¿Banear a este usuario?",
  "confirmDelete": "¿Eliminar este enlace permanentemente?"
}
```

In `src/i18n/locales/de.json`:
```json
"nav": { ..., "admin": "Admin" }

"admin": {
  "title": "Admin-Panel",
  "users": "Benutzer",
  "reportedUsers": "Gemeldete Benutzer",
  "reportedLinks": "Gemeldete Links",
  "search": "Suchen...",
  "ban": "Sperren",
  "unban": "Entsperren",
  "banned": "Gesperrt",
  "active": "Aktiv",
  "hide": "Verbergen",
  "delete": "Löschen",
  "resolve": "Lösen",
  "dismiss": "Ablehnen",
  "viewReports": "Meldungen ansehen",
  "stats": "Übersicht",
  "totalUsers": "Gesamtbenutzer",
  "bannedUsers": "Gesperrte Benutzer",
  "openReports": "Offene Meldungen",
  "reportedLinksCount": "Gemeldete Links",
  "noResults": "Keine Ergebnisse",
  "reportReason": "Grund",
  "reportDate": "Datum",
  "confirmBan": "Diesen Benutzer sperren?",
  "confirmDelete": "Diesen Link dauerhaft löschen?"
}
```

- [ ] **Step 16: Commit**

```bash
git add src/components/TopBar.tsx src/App.tsx src/i18n/locales/en.json src/i18n/locales/tr.json src/i18n/locales/es.json src/i18n/locales/de.json
git commit -m "feat: admin nav tab + page route + i18n keys for all locales"
```
