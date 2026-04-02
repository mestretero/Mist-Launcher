import { prisma } from "../lib/prisma.js";
import { createNotification } from "./notification.service.js";

export async function unlockAchievement(userId: string, achievementId: string, unlockedAt?: Date) {
  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId } },
  });
  if (existing) return existing;

  const achievement = await prisma.achievement.findUniqueOrThrow({ where: { id: achievementId } });

  const unlock = await prisma.userAchievement.create({
    data: { userId, achievementId, ...(unlockedAt ? { unlockedAt } : {}) },
  });

  await createNotification(
    userId,
    "ACHIEVEMENT_UNLOCKED",
    "Başarım Açıldı!",
    `"${achievement.name}" başarımını kazandın!`,
    { achievementId }
  );

  return { ...unlock, achievement: { name: achievement.name, description: achievement.description, iconUrl: achievement.iconUrl } };
}

export async function getGameAchievements(gameId: string, userId?: string) {
  const achievements = await prisma.achievement.findMany({
    where: { gameId },
    include: { unlocks: userId ? { where: { userId } } : false },
  });

  return achievements.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    iconUrl: a.iconUrl,
    unlocked: userId ? a.unlocks.length > 0 : false,
    unlockedAt: userId ? a.unlocks[0]?.unlockedAt : null,
  }));
}

export async function getUserAchievementStats(userId: string, gameId: string) {
  const [total, unlocked] = await Promise.all([
    prisma.achievement.count({ where: { gameId } }),
    prisma.userAchievement.count({
      where: { userId, achievement: { gameId } },
    }),
  ]);
  return { total, unlocked };
}

/** All unlocked achievements across all games for a user (profile showcase) */
export async function getUserAllAchievements(userId: string) {
  const unlocks = await prisma.userAchievement.findMany({
    where: { userId },
    include: {
      achievement: {
        include: { game: { select: { id: true, title: true, coverImageUrl: true } } },
      },
    },
    orderBy: { unlockedAt: "desc" },
  });

  return unlocks.map((u) => ({
    id: u.achievement.id,
    name: u.achievement.name,
    description: u.achievement.description,
    iconUrl: u.achievement.iconUrl,
    unlocked: true,
    unlockedAt: u.unlockedAt.toISOString(),
    gameTitle: u.achievement.game.title,
    gameCover: u.achievement.game.coverImageUrl,
  }));
}

/** Games where user unlocked ALL achievements (100% completion) */
export async function getUserPerfectGames(userId: string) {
  // Get all games that have achievements AND the user has library items for
  const gamesWithAchievements = await prisma.game.findMany({
    where: {
      achievements: { some: {} },
      libraryItems: { some: { userId } },
    },
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
      _count: { select: { achievements: true } },
    },
  });

  if (gamesWithAchievements.length === 0) return [];

  const gameIds = gamesWithAchievements.map((g) => g.id);

  // Batch: fetch ALL user achievements for these games in one query
  const allUnlocks = await prisma.userAchievement.findMany({
    where: { userId, achievement: { gameId: { in: gameIds } } },
    select: { unlockedAt: true, achievement: { select: { gameId: true } } },
  });

  // Group unlocks by game
  const unlocksByGame = new Map<string, Date[]>();
  for (const u of allUnlocks) {
    const gid = u.achievement.gameId;
    if (!unlocksByGame.has(gid)) unlocksByGame.set(gid, []);
    unlocksByGame.get(gid)!.push(u.unlockedAt);
  }

  return gamesWithAchievements
    .filter((game) => (unlocksByGame.get(game.id)?.length ?? 0) >= game._count.achievements)
    .map((game) => {
      const dates = unlocksByGame.get(game.id)!;
      const latest = dates.reduce((a, b) => (a > b ? a : b));
      return {
        id: game.id,
        title: game.title,
        coverImageUrl: game.coverImageUrl,
        totalAchievements: game._count.achievements,
        completedAt: latest.toISOString(),
      };
    });
}
