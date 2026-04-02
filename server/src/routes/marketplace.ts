import { FastifyInstance } from "fastify";
import * as marketplaceService from "../services/marketplace.service.js";

export default async function marketplaceRoutes(app: FastifyInstance) {
  app.get("/marketplace/themes", async () => {
    const themes = await marketplaceService.listThemes();
    return { data: themes };
  });

  app.get("/marketplace/my-themes", { preHandler: [app.authenticate] }, async (request) => {
    const ids = await marketplaceService.getOwnedThemeIds(request.user!.userId);
    return { data: ids };
  });

  app.post("/marketplace/themes/:id/purchase", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const result = await marketplaceService.purchaseTheme(request.user!.userId, id);
    return { data: result };
  });
}
