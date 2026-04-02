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

  // ── Game requests ─────────────────────────────────
  app.get("/admin/game-requests", async (request) => {
    const { page = "1", limit = "20" } = request.query as { page?: string; limit?: string };
    const result = await adminService.getGameRequests(parseInt(page), parseInt(limit));
    return { data: result };
  });

  app.patch("/admin/game-requests/:id", async (request) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: "APPROVED" | "REJECTED" };
    const result = await adminService.resolveGameRequest(id, status);
    return { data: result };
  });

  app.delete("/admin/game-requests/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await adminService.deleteGameRequest(id);
    return reply.status(204).send();
  });

  // ── Game management ──────────────────────────────────
  app.get("/admin/games", async (request) => {
    const { search, page = "1", limit = "20" } = request.query as { search?: string; page?: string; limit?: string };
    const result = await adminService.listGames(search, parseInt(page), parseInt(limit));
    return { data: result };
  });

  app.delete("/admin/games/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await adminService.deleteGame(id);
    return reply.status(204).send();
  });

  app.post("/admin/steam/add/:appId", async (request) => {
    const { appId } = request.params as { appId: string };
    const result = await steamService.syncByAppIds([parseInt(appId)]);
    return { data: result };
  });
}
