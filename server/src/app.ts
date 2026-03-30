import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import multipart from "@fastify/multipart";
import { join } from "path";
import { fileURLToPath } from "url";
import authPlugin from "./plugins/auth.plugin.js";
import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/games.js";
import libraryRoutes from "./routes/library.js";
import paymentRoutes from "./routes/payments.js";
import wishlistRoutes from "./routes/wishlist.js";
import walletRoutes from "./routes/wallet.js";
import reviewRoutes from "./routes/reviews.js";
import notificationRoutes from "./routes/notifications.js";
import friendRoutes from "./routes/friends.js";
import achievementRoutes from "./routes/achievements.js";
import collectionRoutes from "./routes/collections.js";
import cartRoutes from "./routes/cart.js";
import profileRoutes from "./routes/profiles.js";
import marketplaceRoutes from "./routes/marketplace.js";
import adminRoutes from "./routes/admin.js";
import communityLinkRoutes from "./routes/communityLinks.js";
import roomRoutes from "./routes/rooms.js";
import hostingProfileRoutes from "./routes/hosting-profiles.js";
import { AppError } from "./lib/errors.js";
import { ZodError } from "zod";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// BigInt serialization support for Prisma 7
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] });
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB max
  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(fastifyStatic, {
    root: join(__dirname, "..", "public"),
    prefix: "/public/",
  });
  await app.register(authPlugin);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message || "Invalid input" },
      });
    }
    // Fastify empty JSON body error — treat as 400
    if ((error as any).code === "FST_ERR_CTP_EMPTY_JSON_BODY") {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "Empty body" },
      });
    }
    request.log.error(error);
    return reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  });

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(authRoutes);
  await app.register(gameRoutes);
  await app.register(libraryRoutes);
  await app.register(paymentRoutes);
  await app.register(wishlistRoutes);
  await app.register(walletRoutes);
  await app.register(reviewRoutes);
  await app.register(notificationRoutes);
  await app.register(friendRoutes);
  await app.register(achievementRoutes);
  await app.register(collectionRoutes);
  await app.register(cartRoutes);
  await app.register(profileRoutes);
  await app.register(marketplaceRoutes);
  await app.register(adminRoutes);
  await app.register(communityLinkRoutes);
  await app.register(roomRoutes);
  await app.register(hostingProfileRoutes);

  return app;
}
