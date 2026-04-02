import { FastifyInstance } from "fastify";
import * as collectionService from "../services/collection.service.js";

export default async function collectionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/collections", async (request) => {
    const collections = await collectionService.getCollections(request.user!.userId);
    return { data: collections };
  });

  app.post("/collections", async (request) => {
    const { name } = request.body as { name: string };
    const collection = await collectionService.createCollection(request.user!.userId, name);
    return { data: collection };
  });

  app.delete("/collections/:id", async (request) => {
    const { id } = request.params as { id: string };
    await collectionService.deleteCollection(request.user!.userId, id);
    return { data: { success: true } };
  });

  app.post("/collections/:id/games/:gameId", async (request) => {
    const { id, gameId } = request.params as { id: string; gameId: string };
    const item = await collectionService.addGameToCollection(request.user!.userId, id, gameId);
    return { data: item };
  });

  app.delete("/collections/:id/games/:gameId", async (request) => {
    const { id, gameId } = request.params as { id: string; gameId: string };
    await collectionService.removeGameFromCollection(request.user!.userId, id, gameId);
    return { data: { success: true } };
  });
}
