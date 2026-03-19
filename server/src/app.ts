import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { join } from "path";
import { fileURLToPath } from "url";
import authPlugin from "./plugins/auth.plugin.js";
import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/games.js";
import libraryRoutes from "./routes/library.js";
import paymentRoutes from "./routes/payments.js";
import { AppError } from "./lib/errors.js";
import { ZodError } from "zod";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// BigInt serialization support for Prisma 7
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(helmet);
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

  return app;
}
