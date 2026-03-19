import { prisma } from "../lib/prisma.js";
import { notFound, forbidden } from "../lib/errors.js";

export async function getUserLibrary(userId: string) {
  return prisma.libraryItem.findMany({
    where: { userId },
    include: {
      game: {
        include: { publisher: { select: { name: true } } },
      },
    },
    orderBy: { purchasedAt: "desc" },
  });
}

export async function updatePlayTime(userId: string, itemId: string, playTimeMins: number) {
  const item = await prisma.libraryItem.findUnique({ where: { id: itemId } });
  if (!item) throw notFound("Library item not found");
  if (item.userId !== userId) throw forbidden("Not your library item");

  return prisma.libraryItem.update({
    where: { id: itemId },
    data: { playTimeMins, lastPlayedAt: new Date() },
  });
}

export async function getDownloadUrl(userId: string, itemId: string) {
  const item = await prisma.libraryItem.findUnique({
    where: { id: itemId },
    include: { game: true },
  });
  if (!item) throw notFound("Library item not found");
  if (item.userId !== userId) throw forbidden("Not your library item");

  const url = item.game.downloadUrl || `https://demo.stealike.com/downloads/${item.game.slug}.zip`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  return { url, expires_at: expiresAt.toISOString() };
}
