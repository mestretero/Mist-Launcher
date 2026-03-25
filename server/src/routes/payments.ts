import { FastifyInstance } from "fastify";
import { paymentInitSchema, installmentQuerySchema } from "../schemas/payment.schema.js";
import * as paymentService from "../services/payment.service.js";

export default async function paymentRoutes(app: FastifyInstance) {
  app.post("/payments/init", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const body = paymentInitSchema.parse(request.body);
      const result = await paymentService.initPayment(request.user!.userId, body);
      return { data: result };
    },
  });

  app.post("/payments/callback", async (request) => {
    // iyzico sends `paymentId`; service param is named `paymentToken` (positional)
    const { paymentId } = request.body as { paymentId: string };
    const result = await paymentService.handleCallback(paymentId);
    return { data: result };
  });

  app.get("/payments/installments", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { binNumber, price } = installmentQuerySchema.parse(request.query);
      const result = await paymentService.getInstallments(binNumber, price);
      return { data: result };
    },
  });

  app.get("/payments/history", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const payments = await paymentService.getPaymentHistory(request.user!.userId);
      return { data: payments };
    },
  });
}
