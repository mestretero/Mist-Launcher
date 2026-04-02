import { FastifyInstance } from "fastify";
import * as cartService from "../services/cart.service.js";

export default async function cartRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/cart", async (request) => {
    const cart = await cartService.getCart(request.user!.userId);
    return { data: cart };
  });

  app.post("/cart/:gameId", async (request) => {
    const { gameId } = request.params as { gameId: string };
    const cart = await cartService.addToCart(request.user!.userId, gameId);
    return { data: cart };
  });

  app.delete("/cart/:gameId", async (request) => {
    const { gameId } = request.params as { gameId: string };
    const cart = await cartService.removeFromCart(request.user!.userId, gameId);
    return { data: cart };
  });

  app.delete("/cart", async (request) => {
    const cart = await cartService.clearCart(request.user!.userId);
    return { data: cart };
  });
}
