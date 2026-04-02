import { prisma } from "../lib/prisma.js";
import { conflict, notFound } from "../lib/errors.js";

export async function addToWishlist(userId: string, gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw notFound("Game not found");

  const existing = await prisma.wishlist.findUnique({ where: { userId_gameId: { userId, gameId } } });
  if (existing) throw conflict("Already in wishlist");

  return prisma.wishlist.create({ data: { userId, gameId } });
}

export async function removeFromWishlist(userId: string, gameId: string) {
  const item = await prisma.wishlist.findUnique({ where: { userId_gameId: { userId, gameId } } });
  if (!item) throw notFound("Not in wishlist");
  return prisma.wishlist.delete({ where: { id: item.id } });
}

export async function getWishlist(userId: string) {
  return prisma.wishlist.findMany({
    where: { userId },
    include: { game: { include: { publisher: { select: { name: true, slug: true } } } } },
    orderBy: { addedAt: "desc" },
  });
}

export async function isInWishlist(userId: string, gameId: string) {
  const item = await prisma.wishlist.findUnique({ where: { userId_gameId: { userId, gameId } } });
  return !!item;
}
