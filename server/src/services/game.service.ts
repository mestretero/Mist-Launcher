import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";

export async function listGames(page: number, limit: number) {
  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where: { status: "PUBLISHED" },
      include: { publisher: { select: { name: true, slug: true } } },
      orderBy: { releaseDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.game.count({ where: { status: "PUBLISHED" } }),
  ]);
  return { games, total, page };
}

export async function getGameBySlug(slug: string) {
  const game = await prisma.game.findUnique({
    where: { slug },
    include: { publisher: { select: { name: true, slug: true } } },
  });
  if (!game || game.status !== "PUBLISHED") throw notFound("Game not found");
  return game;
}

export async function getFeaturedGames() {
  return prisma.game.findMany({
    where: { status: "PUBLISHED" },
    include: { publisher: { select: { name: true, slug: true } } },
    orderBy: { releaseDate: "desc" },
    take: 6,
  });
}

export async function searchGames(query: string) {
  const games = await prisma.game.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { shortDescription: { contains: query, mode: "insensitive" } },
      ],
    },
    include: { publisher: { select: { name: true, slug: true } } },
    take: 20,
  });
  return { games, total: games.length };
}
