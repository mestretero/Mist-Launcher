import { FastifyInstance } from "fastify";
import { z } from "zod";
import * as walletService from "../services/wallet.service.js";

const depositSchema = z.object({
  amount: z.coerce.number().positive().max(10000),
});

export default async function walletRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/wallet", async (request) => {
    const result = await walletService.getBalance(request.user!.userId);
    return { data: result };
  });

  app.post("/wallet/deposit", async (request) => {
    const { amount } = depositSchema.parse(request.body);
    const result = await walletService.deposit(request.user!.userId, amount);
    return { data: result };
  });

  app.get("/wallet/history", async (request) => {
    const transactions = await walletService.getHistory(request.user!.userId);
    return { data: transactions };
  });
}
