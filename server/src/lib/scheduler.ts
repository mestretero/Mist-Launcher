// server/src/lib/scheduler.ts
export function startScheduler() {
  const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  async function runCleanup() {
    try {
      const { cleanupOldMessages } = await import("../services/dm.service.js");
      await cleanupOldMessages();
    } catch (e) {
      console.error("DM cleanup error:", e);
    }
    try {
      const { cleanupOldMessages: cleanupGroupMessages } = await import("../services/group.service.js");
      await cleanupGroupMessages();
    } catch (e) {
      console.error("Group message cleanup error:", e);
    }
    try {
      const { cleanupExpiredNotifications } = await import("../services/notification.service.js");
      await cleanupExpiredNotifications();
    } catch (e) {
      console.error("Notification cleanup error:", e);
    }
  }

  // Run once immediately on startup
  runCleanup();
  // Then every 30 minutes
  const interval = setInterval(runCleanup, INTERVAL_MS);
  return interval;
}
