import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(100)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  referralCode: z.string().max(20).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  deviceId: z.string().max(64).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const verifyStudentSchema = z.object({
  studentEmail: z.string().email().refine(
    (email) => email.endsWith(".edu.tr"),
    { message: "Must be a .edu.tr email address" }
  ),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
