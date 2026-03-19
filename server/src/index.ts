import { buildApp } from "./app.js";

const start = async () => {
  const app = await buildApp();
  await app.listen({ port: 3001, host: "0.0.0.0" });
};

start();
