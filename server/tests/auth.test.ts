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
  await prisma.refreshToken.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: "test" } } });
  await prisma.$disconnect();
  await app.close();
});

describe("POST /auth/register", () => {
  it("creates a new user and returns tokens", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@test.com", username: "testuser", password: "password123" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.user.email).toBe("test@test.com");
    expect(body.data.tokens.accessToken).toBeDefined();
    expect(body.data.tokens.refreshToken).toBeDefined();
  });

  it("returns 409 for duplicate email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@test.com", username: "testuser2", password: "password123" },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe("POST /auth/login", () => {
  it("returns tokens for valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "test@test.com", password: "password123" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.tokens.accessToken).toBeDefined();
  });

  it("returns 401 for wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "test@test.com", password: "wrongpassword" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /auth/verify-student", () => {
  it("verifies student with .edu.tr email", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "test@test.com", password: "password123" },
    });
    const token = JSON.parse(login.body).data.tokens.accessToken;

    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-student",
      headers: { authorization: `Bearer ${token}` },
      payload: { studentEmail: "student@university.edu.tr" },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.verified).toBe(true);
  });

  it("rejects non-.edu.tr email", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "test@test.com", password: "password123" },
    });
    const token = JSON.parse(login.body).data.tokens.accessToken;

    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-student",
      headers: { authorization: `Bearer ${token}` },
      payload: { studentEmail: "student@gmail.com" },
    });
    expect(res.statusCode).toBe(400);
  });
});
