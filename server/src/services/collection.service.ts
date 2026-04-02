import { prisma } from "../lib/prisma.js";
import { notFound, conflict } from "../lib/errors.js";

export async function createCollection(userId: string, name: string) {
  return prisma.gameCollection.create({ data: { userId, name } });
}

export async function deleteCollection(userId: string, collectionId: string) {
  const col = await prisma.gameCollection.findUnique({ where: { id: collectionId } });
  if (!col || col.userId !== userId) throw notFound("Collection not found");
  return prisma.gameCollection.delete({ where: { id: collectionId } });
}

export async function getCollections(userId: string) {
  return prisma.gameCollection.findMany({
    where: { userId },
    include: { items: { include: { game: { select: { id: true, title: true, coverImageUrl: true, slug: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function addGameToCollection(userId: string, collectionId: string, gameId: string) {
  const col = await prisma.gameCollection.findUnique({ where: { id: collectionId } });
  if (!col || col.userId !== userId) throw notFound("Collection not found");

  const existing = await prisma.gameCollectionItem.findUnique({ where: { collectionId_gameId: { collectionId, gameId } } });
  if (existing) throw conflict("Already in collection");

  return prisma.gameCollectionItem.create({ data: { collectionId, gameId } });
}

export async function removeGameFromCollection(userId: string, collectionId: string, gameId: string) {
  const col = await prisma.gameCollection.findUnique({ where: { id: collectionId } });
  if (!col || col.userId !== userId) throw notFound("Collection not found");

  const item = await prisma.gameCollectionItem.findUnique({ where: { collectionId_gameId: { collectionId, gameId } } });
  if (!item) throw notFound("Not in collection");

  return prisma.gameCollectionItem.delete({ where: { id: item.id } });
}
