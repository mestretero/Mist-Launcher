import { FastifyInstance } from "fastify";
import { gameListSchema, searchSchema } from "../schemas/game.schema.js";
import * as gameService from "../services/game.service.js";

export default async function gameRoutes(app: FastifyInstance) {
  app.get("/games", async (request, reply) => {
    const { page, limit, category } = gameListSchema.parse(request.query);
    const result = await gameService.listGames(page, limit, category);
    return reply.send({ data: result.games, meta: { total: result.total, page: result.page } });
  });

  app.get("/games/featured", async (request, reply) => {
    const games = await gameService.getFeaturedGames();
    return reply.send({ data: games });
  });

  app.get("/games/search", async (request, reply) => {
    const { q } = searchSchema.parse(request.query);
    const result = await gameService.searchGames(q);
    return reply.send({ data: result.games, meta: { total: result.total } });
  });

  app.get("/games/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const game = await gameService.getGameBySlug(slug);
    return reply.send({ data: game });
  });
}
