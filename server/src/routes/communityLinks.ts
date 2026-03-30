import { FastifyInstance } from "fastify";
import * as communityLinkService from "../services/communityLink.service.js";

export default async function communityLinkRoutes(app: FastifyInstance) {
  // Public (with optional auth for userVote)
  app.get("/games/:slug/community-links", {
    preHandler: [app.tryAuthenticate],
    handler: async (request) => {
      const { slug } = request.params as { slug: string };
      const { prisma } = await import("../lib/prisma.js");
      const game = await prisma.game.findUnique({ where: { slug } });
      if (!game) return { data: { links: [] } };

      const isAdmin = request.user?.isAdmin ?? false;
      const links = await communityLinkService.getLinksForGame(game.id, request.user?.userId, isAdmin);
      return { data: { links } };
    },
  });

  // Auth required: create link
  app.post("/games/:slug/community-links", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { slug } = request.params as { slug: string };
      const body = request.body as {
        title: string;
        description?: string;
        size?: string;
        crackInfo?: string;
        mirrors: { sourceName: string; url: string }[];
      };

      const { badRequest } = await import("../lib/errors.js");
      if (!body.title || body.title.length < 3) throw badRequest("Title must be at least 3 characters");
      if (!body.mirrors?.length) throw badRequest("At least one mirror required");

      const { prisma } = await import("../lib/prisma.js");
      const game = await prisma.game.findUnique({ where: { slug } });
      if (!game) throw new Error("Game not found");

      const link = await communityLinkService.createLink(
        game.id,
        request.user!.userId,
        request.user!.isAdmin,
        body,
      );
      return { data: link };
    },
  });

  // Auth required: vote
  app.post("/games/:slug/community-links/:linkId/vote", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { linkId } = request.params as { linkId: string };
      const { voteType } = request.body as { voteType: "UP" | "DOWN" };

      if (!["UP", "DOWN"].includes(voteType)) {
        throw new Error("Invalid vote type");
      }

      const result = await communityLinkService.vote(linkId, request.user!.userId, voteType);
      return { data: result };
    },
  });

  // Auth required: report virus
  app.post("/games/:slug/community-links/:linkId/report", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { linkId } = request.params as { linkId: string };
      const result = await communityLinkService.report(linkId, request.user!.userId);
      return { data: result };
    },
  });

  // Auth required: delete (owner or admin)
  app.delete("/games/:slug/community-links/:linkId", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { linkId } = request.params as { linkId: string };
      await communityLinkService.deleteLink(linkId, request.user!.userId, request.user!.isAdmin);
      return { data: { success: true } };
    },
  });

  // Admin only: toggle hide
  app.patch("/games/:slug/community-links/:linkId/toggle-hide", {
    preHandler: [app.adminGuard],
    handler: async (request) => {
      const { linkId } = request.params as { linkId: string };
      const result = await communityLinkService.toggleHide(linkId);
      return { data: result };
    },
  });
}
