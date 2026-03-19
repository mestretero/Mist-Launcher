import { prisma } from "../lib/prisma.js";
import { notFound, badRequest, conflict } from "../lib/errors.js";
import { calculatePrice } from "./pricing.service.js";
import * as iyzico from "../plugins/iyzico.plugin.js";
import { randomUUID } from "crypto";

export async function initPayment(userId: string, input: {
  gameId: string;
  referralCode?: string;
  paymentMethod: string;
  installmentCount: number;
  cardNumber?: string;
  cardHolderName?: string;
  expireMonth?: string;
  expireYear?: string;
  cvc?: string;
}) {
  const game = await prisma.game.findUnique({ where: { id: input.gameId } });
  if (!game) throw notFound("Game not found");

  // Check if already owned
  const existing = await prisma.libraryItem.findUnique({
    where: { userId_gameId: { userId, gameId: input.gameId } },
  });
  if (existing) throw conflict("Game already in library");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User not found");

  // Resolve referral
  let referral = null;
  let referralDiscount = 0;
  if (input.referralCode) {
    referral = await prisma.referral.findUnique({ where: { code: input.referralCode } });
    if (referral && referral.isActive && referral.ownerId !== userId) {
      referralDiscount = referral.discountPercent;
    }
  }

  // Calculate price
  const pricing = calculatePrice(Number(game.price), {
    isStudent: user.isStudent,
    referralDiscount,
    gameDiscount: game.discountPercent,
  });

  // Create pending payment
  const payment = await prisma.payment.create({
    data: {
      userId,
      gameId: input.gameId,
      basePrice: game.price,
      discountAmount: pricing.discountAmount,
      finalAmount: pricing.finalAmount,
      installmentCount: input.installmentCount,
      paymentMethod: input.paymentMethod as any,
      referralId: referral?.id,
      studentDiscountApplied: pricing.studentDiscountApplied,
    },
  });

  // For demo/sandbox: create iyzico 3D Secure request
  if (input.paymentMethod === "CREDIT_CARD" && input.cardNumber) {
    const conversationId = payment.id;
    const request = {
      locale: "tr",
      conversationId,
      price: pricing.finalAmount.toString(),
      paidPrice: pricing.finalAmount.toString(),
      currency: "TRY",
      installment: input.installmentCount.toString(),
      paymentChannel: "WEB",
      paymentGroup: "PRODUCT",
      callbackUrl: `${process.env.API_URL || "http://localhost:3001"}/payments/callback`,
      paymentCard: {
        cardHolderName: input.cardHolderName,
        cardNumber: input.cardNumber,
        expireMonth: input.expireMonth,
        expireYear: input.expireYear,
        cvc: input.cvc,
      },
      buyer: {
        id: userId,
        name: user.username,
        surname: "User",
        email: user.email,
        identityNumber: "11111111111",
        registrationAddress: "Istanbul",
        city: "Istanbul",
        country: "Turkey",
        ip: "127.0.0.1",
      },
      shippingAddress: {
        contactName: user.username,
        city: "Istanbul",
        country: "Turkey",
        address: "Istanbul",
      },
      billingAddress: {
        contactName: user.username,
        city: "Istanbul",
        country: "Turkey",
        address: "Istanbul",
      },
      basketItems: [
        {
          id: game.id,
          name: game.title,
          category1: "Game",
          itemType: "VIRTUAL",
          price: pricing.finalAmount.toString(),
        },
      ],
    };

    try {
      const result = await iyzico.createPayment(request);
      return { payment_id: payment.id, three_d_html: result.threeDSHtmlContent || null };
    } catch {
      return { payment_id: payment.id, three_d_html: null };
    }
  }

  return { payment_id: payment.id, three_d_html: null };
}

export async function handleCallback(paymentToken: string) {
  // Idempotency: check if already processed
  const existing = await prisma.payment.findUnique({ where: { providerTxId: paymentToken } });
  if (existing && existing.status === "SUCCESS") return { already_processed: true };

  let result;
  try {
    result = await iyzico.handleCallback(paymentToken);
  } catch {
    return { success: false };
  }

  if (result.status !== "success") return { success: false };

  const conversationId = result.conversationId;

  // Transaction: update payment + create library item + update referral
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: conversationId },
      data: { status: "SUCCESS", providerTxId: paymentToken },
    });

    await tx.libraryItem.create({
      data: { userId: payment.userId, gameId: payment.gameId },
    });

    if (payment.referralId) {
      const commissionRate = 0.01; // 1% for users, looked up in practice
      const commission = Number(payment.finalAmount) * commissionRate;
      await tx.referral.update({
        where: { id: payment.referralId },
        data: {
          totalUses: { increment: 1 },
          totalEarnings: { increment: commission },
        },
      });
    }
  });

  return { success: true };
}

export async function getInstallments(binNumber: string, price: string) {
  try {
    return await iyzico.getInstallmentInfo(binNumber, price);
  } catch {
    return { installmentDetails: [] };
  }
}

export async function getPaymentHistory(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    include: { game: { select: { title: true, coverImageUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
}
