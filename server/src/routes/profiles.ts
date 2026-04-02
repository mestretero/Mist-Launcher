import { FastifyInstance } from "fastify";
import { z } from "zod";
import * as profileService from "../services/profile.service.js";
import * as achievementService from "../services/achievement.service.js";

const commentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(500, "Comment too long (max 500 chars)").transform(s => s.trim()),
});

export default async function profileRoutes(app: FastifyInstance) {
  // ─── /profiles/me routes (auth required) ─────────────────────────────────
  // These MUST be registered before /profiles/:username so "me" isn't matched
  // as a username param.

  app.get("/profiles/me", { preHandler: [app.authenticate] }, async (request) => {
    const profile = await profileService.getOrCreateProfile(request.user!.userId);
    return { data: profile };
  });

  app.patch("/profiles/me", { preHandler: [app.authenticate] }, async (request) => {
    const body = request.body as {
      visibility?: "PUBLIC" | "FRIENDS" | "PRIVATE";
      allowComments?: boolean;
      bannerTheme?: string;
      bannerMirrored?: boolean;
      customStatus?: string | null;
    };
    const profile = await profileService.updateProfile(request.user!.userId, body);
    return { data: profile };
  });

  app.put("/profiles/me/blocks", { preHandler: [app.authenticate] }, async (request) => {
    const blocks = request.body as Array<{
      type: string;
      position: number;
      config?: Record<string, unknown>;
      visible?: boolean;
    }>;
    const result = await profileService.saveBlocks(request.user!.userId, blocks);
    return { data: result };
  });

  app.post("/profiles/me/blocks", { preHandler: [app.authenticate] }, async (request) => {
    const { type, config } = request.body as {
      type: string;
      config?: Record<string, unknown>;
    };
    const block = await profileService.addBlock(request.user!.userId, type, config);
    return { data: block };
  });

  app.delete(
    "/profiles/me/blocks/:id",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      await profileService.deleteBlock(request.user!.userId, id);
      return { data: { success: true } };
    }
  );

  // ─── Sync local games (must be before :username routes) ─────────────────
  app.post("/profiles/me/sync-games", { preHandler: [app.authenticate] }, async (request) => {
    const games = request.body as Array<{
      title: string;
      coverUrl?: string | null;
      playTimeMins: number;
      exePathHash: string;
      lastPlayedAt?: string | null;
    }>;
    if (!Array.isArray(games)) throw new Error("Body must be an array");
    const result = await profileService.syncGames(request.user!.userId, games);
    return { data: result };
  });

  app.patch("/profiles/me/sync-games", { preHandler: [app.authenticate] }, async (request) => {
    const data = request.body as {
      exePathHash: string;
      playTimeMins: number;
      lastPlayedAt?: string | null;
      title?: string;
    };
    const result = await profileService.updateSyncGame(request.user!.userId, data);
    return { data: result };
  });

  // ─── /profiles/:username routes ───────────────────────────────────────────

  app.get("/profiles/:username", async (request) => {
    const { username } = request.params as { username: string };
    const viewerId = (request as any).user?.userId as string | undefined;
    const result = await profileService.getProfileByUsername(username, viewerId);
    return { data: result };
  });

  app.get("/profiles/:username/library-summary", async (request) => {
    const { username } = request.params as { username: string };
    const viewerId = (request as any).user?.userId as string | undefined;
    const result = await profileService.getLibrarySummary(username, viewerId);
    return { data: result };
  });

  app.get("/profiles/:username/achievements", async (request) => {
    const { username } = request.params as { username: string };
    const viewerId = (request as any).user?.userId as string | undefined;
    const user = await profileService.getProfileByUsername(username, viewerId);
    const achievements = await achievementService.getUserAllAchievements(user.user.id);
    return { data: achievements };
  });

  app.get("/profiles/:username/perfect-games", async (request) => {
    const { username } = request.params as { username: string };
    const viewerId = (request as any).user?.userId as string | undefined;
    const user = await profileService.getProfileByUsername(username, viewerId);
    const perfectGames = await achievementService.getUserPerfectGames(user.user.id);
    return { data: perfectGames };
  });

  app.get(
    "/profiles/:username/comments",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { username } = request.params as { username: string };
      const { page, limit } = request.query as { page?: string; limit?: string };
      const result = await profileService.getComments(
        username,
        request.user!.userId,
        page ? parseInt(page, 10) : 1,
        limit ? parseInt(limit, 10) : 20
      );
      return { data: result };
    }
  );

  app.post(
    "/profiles/:username/comments",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { username } = request.params as { username: string };
      const { content } = commentSchema.parse(request.body);
      const comment = await profileService.addComment(
        username,
        request.user!.userId,
        content
      );
      return { data: comment };
    }
  );

  app.delete(
    "/profiles/:username/comments/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const { id } = request.params as { username: string; id: string };
        await profileService.deleteComment(request.user!.userId, id);
        return { data: { success: true } };
      } catch (err: any) {
        const status = err.statusCode || 500;
        return reply.status(status).send({ error: { code: err.code || "ERROR", message: err.message || "Unknown error" } });
      }
    }
  );
}
