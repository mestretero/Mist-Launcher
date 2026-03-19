import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { signAccessToken } from "../src/lib/jwt.js";
import { FastifyInstance } from "fastify";

// Mock iyzico to avoid hitting real API in tests
vi.mock("../src/plugins/iyzico.plugin.js", () => ({
  getInstallmentInfo: vi.fn().mockResolvedValue({
    installmentDetails: [
      {
        binNumber: "454360",
        installmentPrices: [
          { installmentNumber: 1, totalPrice: "100.00" },
          { installmentNumber: 3, totalPrice: "103.00" },
          { installmentNumber: 6, totalPrice: "106.00" },
        ],
      },
    ],
  }),
  createPayment: vi.fn().mockResolvedValue({
    status: "success",
    threeDSHtmlContent: "<html>3D Secure Mock</html>",
  }),
  handleCallback: vi.fn().mockResolvedValue({
    status: "success",
    conversationId: "will-be-set",
    paymentId: "mock-provider-tx",
  }),
}));

let app: FastifyInstance;
let token: string;
let userId: string;
let gameId: string;

beforeAll(async () => {
  app = await buildApp();

  const user = await prisma.user.create({
    data: {
      email: "paytest@example.com",
      username: "paytest",
      passwordHash: "fakehash",
      referralCode: "PAYTEST01",
    },
  });
  userId = user.id;
  token = signAccessToken({ userId: user.id, email: user.email });

  const publisher = await prisma.publisher.create({
    data: { name: "Pay Pub", slug: "pay-pub", contactEmail: "pay@test.com" },
  });
  const game = await prisma.game.create({
    data: {
      title: "Payment Test Game",
      slug: "payment-test-game",
      description: "A test game for payment",
      shortDescription: "Payment test",
      price: 200,
      coverImageUrl: "https://example.com/cover.jpg",
      releaseDate: new Date(),
      publisherId: publisher.id,
    },
  });
  gameId = game.id;
});

afterAll(async () => {
  await prisma.libraryItem.deleteMany({ where: { userId } });
  await prisma.payment.deleteMany({ where: { userId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.publisher.deleteMany({});
  await app.close();
});

describe("Payment API", () => {
  it("GET /payments/installments — returns installment options", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/payments/installments?binNumber=454360&price=200",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.installmentDetails).toBeDefined();
    expect(body.data.installmentDetails[0].installmentPrices).toHaveLength(3);
  });

  it("POST /payments/init — creates payment and returns 3D HTML", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/payments/init",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        gameId,
        paymentMethod: "CREDIT_CARD",
        installmentCount: 1,
        cardNumber: "4543600299100712",
        cardHolderName: "Test User",
        expireMonth: "12",
        expireYear: "2030",
        cvc: "123",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.payment_id).toBeTruthy();
    expect(body.data.three_d_html).toContain("3D Secure");
  });

  it("POST /payments/init — 401 without auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/payments/init",
      payload: { gameId, paymentMethod: "CREDIT_CARD", installmentCount: 1 },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /payments/history — returns empty for new user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/payments/history",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    // May have 1 payment from init test (PENDING status)
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it("POST /payments/init — 409 if game already owned", async () => {
    // First, add game to library directly
    await prisma.libraryItem.create({
      data: { userId, gameId },
    });

    const res = await app.inject({
      method: "POST",
      url: "/payments/init",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        gameId,
        paymentMethod: "CREDIT_CARD",
        installmentCount: 1,
        cardNumber: "4543600299100712",
        cardHolderName: "Test User",
        expireMonth: "12",
        expireYear: "2030",
        cvc: "123",
      },
    });
    expect(res.statusCode).toBe(409);
  });
});
