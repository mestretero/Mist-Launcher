import { prisma } from "../lib/prisma.js";
import { notFound, conflict, forbidden } from "../lib/errors.js";

export async function createReview(userId: string, gameId: string, rating: number, content: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw notFound("Game not found");

  const existing = await prisma.review.findUnique({ where: { userId_gameId: { userId, gameId } } });
  if (existing) throw conflict("Already reviewed");

  return prisma.review.create({
    data: { userId, gameId, rating: Math.min(5, Math.max(1, rating)), content },
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
  });
}

export async function updateReview(userId: string, gameId: string, rating: number, content: string) {
  const review = await prisma.review.findUnique({ where: { userId_gameId: { userId, gameId } } });
  if (!review) throw notFound("Review not found");
  if (review.userId !== userId) throw forbidden("Not your review");

  return prisma.review.update({
    where: { id: review.id },
    data: { rating: Math.min(5, Math.max(1, rating)), content },
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
  });
}

export async function deleteReview(userId: string, gameId: string) {
  const review = await prisma.review.findUnique({ where: { userId_gameId: { userId, gameId } } });
  if (!review) throw notFound("Review not found");
  if (review.userId !== userId) throw forbidden("Not your review");

  return prisma.review.delete({ where: { id: review.id } });
}

export async function getGameReviews(gameId: string) {
  const reviews = await prisma.review.findMany({
    where: { gameId },
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const stats = await prisma.review.aggregate({
    where: { gameId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    reviews,
    averageRating: stats._avg.rating || 0,
    totalReviews: stats._count.rating,
  };
}
