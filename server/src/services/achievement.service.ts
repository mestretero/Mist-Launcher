import { prisma } from "../lib/prisma.js";
import { createNotification } from "./notification.service.js";

export async function unlockAchievement(userId: string, achievementId: string) {
  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId } },
  });
  if (existing) return existing;

  const unlock = await prisma.userAchievement.create({
    data: { userId, achievementId },
  });

  const achievement = await prisma.achievement.findUniqueOrThrow({ where: { id: achievementId } });
  await createNotification(
    userId,
    "ACHIEVEMENT_UNLOCKED",
    "Başarım Açıldı!",
    `"${achievement.name}" başarımını kazandın!`,
    { achievementId }
  );

  return unlock;
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
