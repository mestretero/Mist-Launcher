import { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerSchema, loginSchema, refreshSchema, verifyStudentSchema } from "../schemas/auth.schema.js";
import * as authService from "../services/auth.service.js";
import * as twoFactorService from "../services/twoFactor.service.js";
import { AppError } from "../lib/errors.js";

const preferencesSchema = z.object({
  downloadPath: z.string().optional(),
  bandwidthLimit: z.string().optional(),
  profileThemeIndex: z.number().int().min(0).max(10).optional(),
  language: z.string().optional(),
  showEmail: z.boolean().optional(),
  customStatus: z.string().max(100).nullable().optional(),
}).strict();

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.registerUser(body);
    return reply.status(201).send({ data: result });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.loginUser(body);
    if (result.requires2FA) {
      return reply.send({ data: { requires2FA: true, userId: result.userId } });
    }
    return reply.send({ data: { user: result.user, tokens: result.tokens } });
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

  app.patch("/auth/profile", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const { bio, avatarUrl } = request.body as { bio?: string; avatarUrl?: string };
      const user = await authService.updateProfile(request.user!.userId, { bio, avatarUrl });
      return reply.send({ data: user });
    },
  });

  app.post("/auth/forgot-password", async (request, reply) => {
    const { email } = request.body as { email: string };
    const result = await authService.forgotPassword(email);
    return reply.send({ data: result });
  });

  app.post("/auth/reset-password", async (request, reply) => {
    const { token, newPassword } = request.body as { token: string; newPassword: string };
    const result = await authService.resetPassword(token, newPassword);
    return reply.send({ data: result });
  });

  app.post("/auth/verify-email", async (request, reply) => {
    const { token } = request.body as { token: string };
    const result = await authService.verifyEmail(token);
    return reply.send({ data: result });
  });

  app.patch("/auth/preferences", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const prefs = preferencesSchema.parse(request.body);
      const merged = await authService.updatePreferences(request.user!.userId, prefs);
      return reply.send({ data: merged });
    },
  });

  // ─── 2FA Endpoints ─────────────────────────────

  app.post("/auth/2fa/setup", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const result = await twoFactorService.generateSetup(request.user!.userId);
      return reply.send({ data: result });
    },
  });

  app.post("/auth/2fa/verify", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const { token } = request.body as { token: string };
      const result = await twoFactorService.verifyAndEnable(request.user!.userId, token);
      return reply.send({ data: result });
    },
  });

  app.post("/auth/2fa/disable", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const result = await twoFactorService.disable(request.user!.userId);
      return reply.send({ data: result });
    },
  });

  app.post("/auth/2fa/login", async (request, reply) => {
    const { userId, token } = request.body as { userId: string; token: string };
    const isValid = await twoFactorService.verifyToken(userId, token);
    if (!isValid) throw new AppError(401, "INVALID_2FA", "Invalid 2FA code");
    const user = await authService.getProfile(userId);
    const tokens = await authService.createTokens(userId, user.email);
    return reply.send({ data: { user, tokens } });
  });
}
