import { FastifyInstance } from "fastify";
import * as achievementService from "../services/achievement.service.js";
import { prisma } from "../lib/prisma.js";

// UUID v4 format validation — prevents path traversal / injection via gameId
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Steam achievement API names are alphanumeric + underscores, max 128 chars
const API_NAME_RE = /^[A-Za-z0-9_]{1,128}$/;

export default async function achievementRoutes(app: FastifyInstance) {
  app.get("/games/:slug/achievements", async (request) => {
    const { slug } = request.params as { slug: string };
    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return { data: [] };
    const userId = request.user?.userId;
    const achievements = await achievementService.getGameAchievements(game.id, userId);
    return { data: achievements };
  });

  app.get("/library/:id/achievements", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const item = await prisma.libraryItem.findUnique({ where: { id } });
      if (!item) return { data: { total: 0, unlocked: 0 } };
      const stats = await achievementService.getUserAchievementStats(request.user!.userId, item.gameId);
      return { data: stats };
    },
  });

  // Called by Tauri when a local achievement file changes
  app.post("/achievements/unlock", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const { gameId, apiName, unlockedAt } = request.body as {
        gameId: string;
        apiName: string;
        unlockedAt?: number;
      };

      if (!UUID_RE.test(gameId)) return reply.status(400).send({ error: "Invalid gameId" });
      if (!API_NAME_RE.test(apiName)) return reply.status(400).send({ error: "Invalid apiName" });

      const achievement = await prisma.achievement.findFirst({
        where: { gameId, apiName },
      });
      if (!achievement) return reply.status(404).send({ error: "Achievement not found" });

      const result = await achievementService.unlockAchievement(
        request.user!.userId,
        achievement.id,
        unlockedAt ? new Date(unlockedAt) : undefined,
      );
      return { data: result };
    },
  });
}
