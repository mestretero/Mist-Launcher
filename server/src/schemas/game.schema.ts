import { z } from "zod";

export const gameListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z.enum(["PUBLISHED", "DRAFT", "DELISTED"]).optional(),
  category: z.string().max(50).optional(),
});

export const searchSchema = z.object({
  q: z.string().min(1).max(100),
});
