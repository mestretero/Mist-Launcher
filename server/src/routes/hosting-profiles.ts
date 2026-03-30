import type { FastifyInstance } from "fastify";
import * as profileService from "../services/hostingProfile.service.js";

export default async function hostingProfileRoutes(app: FastifyInstance) {
  // Public endpoint — no auth required
  app.get("/hosting-profiles", async (request) => {
    const { gameId } = request.query as { gameId?: string };
    const profiles = await profileService.listProfiles(gameId);
    return { data: profiles };
  });
}
