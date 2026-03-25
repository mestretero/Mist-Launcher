import { hash, verify } from "argon2";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { conflict, unauthorized, badRequest, notFound } from "../lib/errors.js";
import { sendPasswordResetEmail, sendEmailVerification } from "./email.service.js";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema.js";

function generateReferralCode(username: string): string {
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `${username.toUpperCase()}-${suffix}`;
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
  });
  if (existing) throw conflict("Email or username already exists");

  const passwordHash = await hash(input.password);
  const referralCode = generateReferralCode(input.username);

  const emailVerifyToken = randomBytes(32).toString("hex");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      referralCode,
      emailVerifyToken,
    },
  });

  await prisma.referral.create({
    data: {
      code: referralCode,
      ownerId: user.id,
      ownerType: "USER",
      discountPercent: 5,
      commissionPercent: 1,
    },
  });

  // Send verification email (fire-and-forget)
  sendEmailVerification(user.email, emailVerifyToken).catch((err) =>
    console.error("Failed to send verification email:", err),
  );

  const tokens = await createTokens(user.id, user.email);

  return {
    user: { id: user.id, email: user.email, username: user.username, referralCode },
    tokens,
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw unauthorized("Invalid credentials");

  const valid = await verify(user.passwordHash, input.password);
  if (!valid) throw unauthorized("Invalid credentials");

  if (user.twoFactorEnabled) {
    return { requires2FA: true as const, userId: user.id };
  }

  const tokens = await createTokens(user.id, user.email);

  return {
    requires2FA: false as const,
    user: { id: user.id, email: user.email, username: user.username, isStudent: user.isStudent, referralCode: user.referralCode },
    tokens,
  };
}

export async function refreshTokens(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) throw unauthorized("Invalid refresh token");

  await prisma.refreshToken.delete({ where: { id: stored.id } });

  return createTokens(payload.userId, payload.email);
}

export async function verifyStudent(userId: string, studentEmail: string) {
  if (!studentEmail.endsWith(".edu.tr")) throw badRequest("Must be a .edu.tr email");

  await prisma.user.update({
    where: { id: userId },
    data: { isStudent: true, studentVerifiedAt: new Date() },
  });

  return { verified: true };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, username: true, isStudent: true, referralCode: true, createdAt: true,
      bio: true, avatarUrl: true, walletBalance: true, isEmailVerified: true, twoFactorEnabled: true,
      preferences: true,
    },
  });
  if (!user) throw notFound("User not found");
  return user;
}

export async function updatePreferences(userId: string, prefs: Record<string, any>) {
  const currentUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const currentPrefs = (currentUser.preferences as Record<string, any>) || {};
  const merged = { ...currentPrefs, ...prefs };
  await prisma.user.update({ where: { id: userId }, data: { preferences: merged } });
  return merged;
}

export async function updateProfile(userId: string, data: { bio?: string; avatarUrl?: string }) {
  return prisma.user.update({
    where: { id: userId },
    data: { bio: data.bio, avatarUrl: data.avatarUrl },
    select: {
      id: true, email: true, username: true, bio: true, avatarUrl: true,
      isStudent: true, referralCode: true, walletBalance: true, isEmailVerified: true, twoFactorEnabled: true,
      preferences: true,
    },
  });
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw notFound("User not found");

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpiry: expiry },
  });

  // Send reset email (fire-and-forget)
  sendPasswordResetEmail(user.email, token).catch((err) =>
    console.error("Failed to send password reset email:", err),
  );

  return { sent: true };
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: { passwordResetToken: token },
  });
  if (!user) throw badRequest("Invalid or expired token");
  if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
    throw badRequest("Invalid or expired token");
  }

  const passwordHash = await hash(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetToken: null, passwordResetExpiry: null },
  });

  return { reset: true };
}

export async function verifyEmail(token: string) {
  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token },
  });
  if (!user) throw badRequest("Invalid token");

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifyToken: null },
  });

  return { verified: true };
}

export async function createTokens(userId: string, email: string) {
  const accessToken = signAccessToken({ userId, email });
  const refreshToken = signRefreshToken({ userId, email });

  await prisma.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken };
}
