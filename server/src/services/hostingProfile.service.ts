import { prisma } from "../lib/prisma.js";

export async function listProfiles(gameId?: string) {
  return prisma.gameHostingProfile.findMany({
    where: {
      isOfficial: true,
      ...(gameId ? { gameId } : {}),
    },
    include: gameId
      ? { game: { select: { id: true, title: true, slug: true } } }
      : undefined,
    orderBy: { gameName: "asc" },
  });
}

export async function getProfileById(id: string) {
  return prisma.gameHostingProfile.findUnique({
    where: { id },
    include: {
      game: { select: { id: true, title: true, slug: true } },
    },
  });
}

export async function getProfileByGameName(gameName: string) {
  return prisma.gameHostingProfile.findFirst({
    where: {
      gameName: { contains: gameName, mode: "insensitive" },
      isOfficial: true,
    },
  });
}
