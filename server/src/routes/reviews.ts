import { FastifyInstance } from "fastify";
import * as reviewService from "../services/review.service.js";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";

export default async function reviewRoutes(app: FastifyInstance) {
  // Public: get reviews for a game
  app.get("/games/:slug/reviews", async (request) => {
    const { slug } = request.params as { slug: string };
    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return { data: { reviews: [], averageRating: 0, totalReviews: 0 } };
    const result = await reviewService.getGameReviews(game.id);
    return { data: result };
  });

  // Auth required for CUD
  app.post("/games/:slug/reviews", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { slug } = request.params as { slug: string };
      const { rating, content } = request.body as { rating: number; content: string };
      const game = await prisma.game.findUnique({ where: { slug } });
      if (!game) throw notFound("Game not found");
      const review = await reviewService.createReview(request.user!.userId, game.id, rating, content);
      return { data: review };
    },
  });

  app.put("/games/:slug/reviews", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { slug } = request.params as { slug: string };
      const { rating, content } = request.body as { rating: number; content: string };
      const game = await prisma.game.findUnique({ where: { slug } });
      if (!game) throw notFound("Game not found");
      const review = await reviewService.updateReview(request.user!.userId, game.id, rating, content);
      return { data: review };
    },
  });

  app.delete("/games/:slug/reviews", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { slug } = request.params as { slug: string };
      const game = await prisma.game.findUnique({ where: { slug } });
      if (!game) throw notFound("Game not found");
      await reviewService.deleteReview(request.user!.userId, game.id);
      return { data: { success: true } };
    },
  });
}
