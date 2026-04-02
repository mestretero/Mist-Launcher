import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 30,
  min: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false,
});

// Prevent unhandled pool errors from crashing the server
pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err.message);
});

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});
