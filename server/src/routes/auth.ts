import { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import { join } from "path";
import { unlink, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { registerSchema, loginSchema, refreshSchema, verifyStudentSchema } from "../schemas/auth.schema.js";
import * as authService from "../services/auth.service.js";
import * as twoFactorService from "../services/twoFactor.service.js";
import { AppError } from "../lib/errors.js";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const AVATARS_DIR = join(import.meta.dirname, "../../public/avatars");

const preferencesSchema = z.object({
  downloadPath: z.string().optional(),
  bandwidthLimit: z.string().optional(),
  profileThemeIndex: z.number().int().min(0).max(10).optional(),
  language: z.string().optional(),
  showEmail: z.boolean().optional(),
  customStatus: z.string().max(100).nullable().optional(),
  profilePublic: z.boolean().optional(),
  libraryPublic: z.boolean().optional(),
  achievementsPublic: z.boolean().optional(),
  notifyFriendRequests: z.boolean().optional(),
  notifyGroupMessages: z.boolean().optional(),
  notifyAchievements: z.boolean().optional(),
  notifySystem: z.boolean().optional(),
}).strict();

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.registerUser(body);
    return reply.status(201).send({ data: result });
  });

  app.post("/auth/login", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.loginUser(body);
    if (result.requires2FA) {
      return reply.send({ data: { requires2FA: true, userId: result.userId } });
    }
    return reply.send({ data: { user: result.user, tokens: result.tokens, dailyBonusAwarded: result.dailyBonusAwarded } });
  });

  app.post("/auth/refresh", async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const tokens = await authService.refreshTokens(body.refreshToken);
    return reply.send({ data: { tokens } });
  });

  app.post("/auth/logout", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const result = await authService.logout(request.user!.userId);
      return reply.send({ data: result });
    },
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
      const { bio, avatarUrl, username } = request.body as { bio?: string; avatarUrl?: string; username?: string };
      if (username !== undefined && (username.trim().length < 3 || username.trim().length > 32)) {
        return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Username must be 3–32 characters" } });
      }
      const user = await authService.updateProfile(request.user!.userId, { bio, avatarUrl, username: username?.trim() });
      return reply.send({ data: user });
    },
  });

  // Avatar upload
  app.post("/auth/avatar", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "No file uploaded" } });
      }

      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Only JPG, PNG, WebP allowed" } });
      }

      // Read file buffer
      const chunks: Buffer[] = [];
      for await (const chunk of file.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      if (buffer.length > MAX_AVATAR_SIZE) {
        return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "File too large (max 2MB)" } });
      }

      // Delete old avatar if exists
      const currentUser = await authService.getProfile(request.user!.userId);
      if (currentUser.avatarUrl) {
        const oldFilename = currentUser.avatarUrl.split("/").pop();
        if (oldFilename) {
          const oldPath = join(AVATARS_DIR, oldFilename);
          try { await unlink(oldPath); } catch {}
        }
      }

      // Save new avatar
      const ext = file.mimetype === "image/png" ? ".png" : file.mimetype === "image/webp" ? ".webp" : ".jpg";
      const filename = `${request.user!.userId}-${randomUUID().slice(0, 8)}${ext}`;
      if (!existsSync(AVATARS_DIR)) await mkdir(AVATARS_DIR, { recursive: true });
      await writeFile(join(AVATARS_DIR, filename), buffer);

      // Update DB
      const avatarUrl = `/public/avatars/${filename}`;
      const user = await authService.updateProfile(request.user!.userId, { avatarUrl });
      return reply.send({ data: user });
    },
  });

  app.post("/auth/forgot-password", { config: { rateLimit: { max: 3, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const { email } = request.body as { email: string };
    const result = await authService.forgotPassword(email);
    return reply.send({ data: result });
  });

  app.post("/auth/reset-password", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const { email, code, newPassword } = request.body as { email: string; code: string; newPassword: string };
    if (!email || !code || !newPassword) {
      return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Missing fields" } });
    }
    const result = await authService.resetPassword(email, code, newPassword);
    return reply.send({ data: result });
  });

  app.post("/auth/verify-email", {
    preHandler: [app.authenticate],
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    handler: async (request, reply) => {
      const { code } = request.body as { code: string };
      const result = await authService.verifyEmail(request.user!.userId, code);
      return reply.send({ data: result });
    },
  });

  app.post("/auth/resend-verification", {
    preHandler: [app.authenticate],
    config: { rateLimit: { max: 3, timeWindow: "15 minutes" } },
    handler: async (request, reply) => {
      const result = await authService.resendEmailVerification(request.user!.userId);
      return reply.send({ data: result });
    },
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

  app.post("/auth/2fa/login", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const { userId, token, deviceId } = request.body as { userId: string; token: string; deviceId?: string };
    const isValid = await twoFactorService.verifyToken(userId, token);
    if (!isValid) throw new AppError(401, "INVALID_2FA", "Invalid 2FA code");

    // Trust this device after successful 2FA
    if (deviceId) {
      await authService.trustDevice(userId, deviceId);
    }

    const user = await authService.getProfile(userId);
    const tokens = await authService.createTokens(userId, user.email);
    return reply.send({ data: { user, tokens } });
  });
}
