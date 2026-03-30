import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { verifyAccessToken, TokenPayload } from "../lib/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: TokenPayload;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    tryAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Missing token" } });
    }
    try {
      request.user = verifyAccessToken(header.slice(7));
    } catch {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
    }
  });

  app.decorate("tryAuthenticate", async function (request: FastifyRequest, _reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    try {
      request.user = verifyAccessToken(header.slice(7));
    } catch {
      // Silent fail — user stays undefined
    }
  });

  app.decorate("adminGuard", async function (request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Missing token" } });
    }
    try {
      request.user = verifyAccessToken(header.slice(7));
    } catch {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
    }
    if (!request.user.isAdmin) {
      return reply.status(403).send({ error: { code: "FORBIDDEN", message: "Admin access required" } });
    }
  });
}

export default fp(authPlugin);
