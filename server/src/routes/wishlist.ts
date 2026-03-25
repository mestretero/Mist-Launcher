import { FastifyInstance } from "fastify";
import * as wishlistService from "../services/wishlist.service.js";

export default async function wishlistRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/wishlist", async (request) => {
    const items = await wishlistService.getWishlist(request.user!.userId);
    return { data: items };
  });

  app.post("/wishlist/:gameId", async (request) => {
    const { gameId } = request.params as { gameId: string };
    const item = await wishlistService.addToWishlist(request.user!.userId, gameId);
    return { data: item };
  });

  app.delete("/wishlist/:gameId", async (request) => {
    const { gameId } = request.params as { gameId: string };
    await wishlistService.removeFromWishlist(request.user!.userId, gameId);
    return { data: { success: true } };
  });

  app.get("/wishlist/:gameId/check", async (request) => {
    const { gameId } = request.params as { gameId: string };
    const inWishlist = await wishlistService.isInWishlist(request.user!.userId, gameId);
    return { data: { wishlisted: inWishlist } };
  });
}
