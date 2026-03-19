import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});

describe("GET /games", () => {
  it("returns paginated game list", async () => {
    const res = await app.inject({ method: "GET", url: "/games" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.meta.total).toBeGreaterThan(0);
  });
});

describe("GET /games/featured", () => {
  it("returns featured games", async () => {
    const res = await app.inject({ method: "GET", url: "/games/featured" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeLessThanOrEqual(6);
  });
});

describe("GET /games/:slug", () => {
  it("returns game by slug", async () => {
    const res = await app.inject({ method: "GET", url: "/games/galactic-odyssey" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.title).toBe("Galactic Odyssey");
  });

  it("returns 404 for unknown slug", async () => {
    const res = await app.inject({ method: "GET", url: "/games/nonexistent" });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /games/search", () => {
  it("searches by title", async () => {
    const res = await app.inject({ method: "GET", url: "/games/search?q=shadow" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
