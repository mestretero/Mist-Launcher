import "dotenv/config";
import { buildApp } from "./app.js";
import { cleanupStaleRooms } from "./services/room.service.js";
import { startScheduler } from "./lib/scheduler.js";

const start = async () => {
  const app = await buildApp();
  const port = Number(process.env.PORT || 3001);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Server listening on port ${port}`);
  await cleanupStaleRooms();
  startScheduler();
};

start().catch((err) => {
  console.error("Server startup failed:", err);
  process.exit(1);
});
