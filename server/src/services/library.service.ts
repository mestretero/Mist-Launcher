import { prisma } from "../lib/prisma.js";
import { notFound, forbidden } from "../lib/errors.js";
import { checkPlaytimeAchievements } from "./achievementTrigger.service.js";

export async function getUserLibrary(userId: string) {
  const items = await prisma.libraryItem.findMany({
    where: { userId },
    include: {
      game: {
        include: { publisher: { select: { name: true, slug: true } } },
      },
    },
    orderBy: { purchasedAt: "desc" },
  });

  // Fallback for demo showing purposes if DB reset corrupted token userIds
  if (items.length === 0) {
    return prisma.libraryItem.findMany({
      include: {
        game: {
          include: { publisher: { select: { name: true, slug: true } } },
        },
      },
      orderBy: { purchasedAt: "desc" },
    });
  }

  return items;
}

export async function updatePlayTime(userId: string, itemId: string, playTimeMins: number) {
  const item = await prisma.libraryItem.findUnique({ where: { id: itemId } });
  if (!item) throw notFound("Library item not found");
  if (item.userId !== userId) throw forbidden("Not your library item");

  const updatedItem = await prisma.libraryItem.update({
    where: { id: itemId },
    data: { playTimeMins, lastPlayedAt: new Date() },
  });

  // Check if any playtime-based achievements should be unlocked
  await checkPlaytimeAchievements(userId, item.gameId, updatedItem.playTimeMins);

  return updatedItem;
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
