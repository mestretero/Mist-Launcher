import { prisma } from "../lib/prisma.js";
import { unlockAchievement } from "./achievement.service.js";

export async function checkPlaytimeAchievements(userId: string, gameId: string, totalPlayTimeMins: number) {
  const achievements = await prisma.achievement.findMany({ where: { gameId } });

  for (const achievement of achievements) {
    // Use simple name-based thresholds for now
    const thresholds: Record<string, number> = {
      "İlk Adım": 10,
      "Kaşif": 60,
      "Veteran": 600,
      "Uzman": 1800,
      "Efsane": 6000,
    };
    const threshold = thresholds[achievement.name];
    if (threshold && totalPlayTimeMins >= threshold) {
      await unlockAchievement(userId, achievement.id);
    }
  }
}
