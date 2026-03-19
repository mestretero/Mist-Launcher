import { FastifyInstance } from "fastify";
import * as libraryService from "../services/library.service.js";

export default async function libraryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/library", async (request) => {
    const items = await libraryService.getUserLibrary(request.user!.userId);
    return { data: items };
  });

  app.patch("/library/:id", async (request) => {
    const { id } = request.params as { id: string };
    const { playTimeMins } = request.body as { playTimeMins: number };
    const item = await libraryService.updatePlayTime(request.user!.userId, id, playTimeMins);
    return { data: item };
  });

  app.get("/library/:id/download", async (request) => {
    const { id } = request.params as { id: string };
    const result = await libraryService.getDownloadUrl(request.user!.userId, id);
    return { data: result };
  });
}
