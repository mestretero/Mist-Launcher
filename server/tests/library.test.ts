import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { signAccessToken } from "../src/lib/jwt.js";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
let token: string;
let userId: string;
let gameId: string;
let libraryItemId: string;

beforeAll(async () => {
  app = await buildApp();

  const user = await prisma.user.create({
    data: {
      email: "libtest@example.com",
      username: "libtest",
      passwordHash: "fakehash",
      referralCode: "LIBTEST01",
    },
  });
  userId = user.id;
  token = signAccessToken({ userId: user.id, email: user.email });

  const publisher = await prisma.publisher.create({
    data: { name: "Test Pub", slug: "test-pub", contactEmail: "pub@test.com" },
  });
  const game = await prisma.game.create({
    data: {
      title: "Library Test Game",
      slug: "library-test-game",
      description: "A test game",
      shortDescription: "A test game",
      price: 100,
      coverImageUrl: "https://example.com/cover.jpg",
      releaseDate: new Date(),
      publisherId: publisher.id,
    },
  });
  gameId = game.id;

  const item = await prisma.libraryItem.create({
    data: { userId: user.id, gameId: game.id },
  });
  libraryItemId = item.id;
});

afterAll(async () => {
  await prisma.libraryItem.deleteMany({ where: { userId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.publisher.deleteMany({});
  await app.close();
});

describe("Library API", () => {
  it("GET /library — returns user library", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/library",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].game.title).toBe("Library Test Game");
  });

  it("GET /library — 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/library" });
    expect(res.statusCode).toBe(401);
  });

  it("PATCH /library/:id — updates play time", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/library/${libraryItemId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { playTimeMins: 120 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.playTimeMins).toBe(120);
    expect(res.json().data.lastPlayedAt).toBeTruthy();
  });

  it("GET /library/:id/download — returns signed URL", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/library/${libraryItemId}/download`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.url).toContain("library-test-game");
    expect(res.json().data.expires_at).toBeTruthy();
  });

  it("GET /library/:id/download — 404 for invalid item", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/library/00000000-0000-0000-0000-000000000000/download",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
