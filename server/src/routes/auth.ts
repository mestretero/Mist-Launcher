import { FastifyInstance } from "fastify";
import { registerSchema, loginSchema, refreshSchema, verifyStudentSchema } from "../schemas/auth.schema.js";
import * as authService from "../services/auth.service.js";
import { AppError } from "../lib/errors.js";

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.registerUser(body);
    return reply.status(201).send({ data: result });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.loginUser(body);
    return reply.send({ data: result });
  });

  app.post("/auth/refresh", async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const tokens = await authService.refreshTokens(body.refreshToken);
    return reply.send({ data: { tokens } });
  });

  app.post("/auth/verify-student", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const body = verifyStudentSchema.parse(request.body);
      const result = await authService.verifyStudent(request.user!.userId, body.studentEmail);
      return reply.send({ data: result });
    },
  });

  app.get("/auth/me", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const user = await authService.getProfile(request.user!.userId);
      return reply.send({ data: user });
    },
  });
}
