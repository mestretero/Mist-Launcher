import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/errors.js";
import { createNotification } from "./notification.service.js";

export async function getBalance(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
  if (!user) throw notFound("User not found");
  return { balance: user.walletBalance };
}

export async function deposit(userId: string, amount: number) {
  if (amount <= 0) throw badRequest("Amount must be positive");

  const user = await prisma.user.update({
    where: { id: userId },
    data: { walletBalance: { increment: amount } },
  });

  const tx = await prisma.walletTransaction.create({
    data: {
      userId,
      amount,
      type: "DEPOSIT",
      balanceAfter: user.walletBalance,
      description: `${amount} TL yüklendi`,
    },
  });

  await createNotification(
    userId,
    "SYSTEM",
    "Bakiye Yüklendi",
    `Cüzdanınıza ${amount} TL yüklendi.`,
    { transactionId: tx.id }
  );

  return { balance: user.walletBalance };
}

export async function deduct(userId: string, amount: number, referenceId?: string, description?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User not found");
  if (Number(user.walletBalance) < amount) throw badRequest("Insufficient balance");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { walletBalance: { decrement: amount } },
  });

  await prisma.walletTransaction.create({
    data: {
      userId,
      amount: -amount,
      type: "PURCHASE",
      referenceId,
      balanceAfter: updated.walletBalance,
      description: description || `${amount} TL harcandı`,
    },
  });

  return { balance: updated.walletBalance };
}

export async function getHistory(userId: string) {
  return prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function addEarning(userId: string, amount: number, referenceId?: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { walletBalance: { increment: amount } },
  });

  await prisma.walletTransaction.create({
    data: {
      userId,
      amount,
      type: "REFERRAL_EARNING",
      referenceId,
      balanceAfter: user.walletBalance,
      description: `Referans kazancı: ${amount} TL`,
    },
  });

  return { balance: user.walletBalance };
}
