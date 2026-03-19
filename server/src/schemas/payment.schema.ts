import { z } from "zod";

export const paymentInitSchema = z.object({
  gameId: z.string().uuid(),
  referralCode: z.string().optional(),
  paymentMethod: z.enum(["CREDIT_CARD", "PAPARA", "ININAL"]).default("CREDIT_CARD"),
  cardNumber: z.string().optional(),
  cardHolderName: z.string().optional(),
  expireMonth: z.string().optional(),
  expireYear: z.string().optional(),
  cvc: z.string().optional(),
  installmentCount: z.number().int().min(1).max(12).default(1),
});

export const installmentQuerySchema = z.object({
  binNumber: z.string().length(6),
  price: z.string(),
});
