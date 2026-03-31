import "dotenv/config";
import { buildApp } from "./app.js";
import { cleanupStaleRooms } from "./services/room.service.js";
import { startScheduler } from "./lib/scheduler.js";

const start = async () => {
  const app = await buildApp();
  await app.listen({ port: 3001, host: "0.0.0.0" });
  await cleanupStaleRooms();
  startScheduler();
};

start();
