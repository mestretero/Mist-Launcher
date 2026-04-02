import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { notFound, badRequest } from "../lib/errors.js";

export async function listThemes() {
  return prisma.theme.findMany({
    where: { isActive: true },
    orderBy: [{ price: "asc" }, { name: "asc" }],
  });
}

export async function getOwnedThemeIds(userId: string): Promise<string[]> {
  // Free themes are always owned
  const freeThemes = await prisma.theme.findMany({
    where: { price: 0, isActive: true },
    select: { id: true },
  });
  const freeIds = freeThemes.map((t) => t.id);

  // Purchased themes
  const purchased = await prisma.userTheme.findMany({
    where: { userId },
    select: { themeId: true },
  });
  const purchasedIds = purchased.map((t) => t.themeId);

  return [...new Set([...freeIds, ...purchasedIds])];
}

export async function purchaseTheme(userId: string, themeId: string) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!theme) throw notFound("Theme not found");

  // Free themes are already owned — return success silently
  if (theme.price === 0) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { success: true, newBalance: Number(user.walletBalance) };
  }

  const newBalance = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (Number(user.walletBalance) < theme.price) {
      throw badRequest("Insufficient MC balance");
    }

    const existing = await tx.userTheme.findUnique({
      where: { userId_themeId: { userId, themeId } },
    });
    if (existing) throw badRequest("Already owned");

    const balance = Number(user.walletBalance) - theme.price;

    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: balance },
    });

    await tx.userTheme.create({
      data: { userId, themeId },
    });

    await tx.walletTransaction.create({
      data: {
        id: randomUUID(),
        userId,
        amount: -theme.price,
        type: "THEME_PURCHASE",
        referenceId: themeId,
        balanceAfter: balance,
        description: `Theme: ${theme.name}`,
      },
    });

    return balance;
  });

  return { success: true, newBalance };
}
