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
      walletBalance: 500,
    },
  });

  // Signup bonus transaction
  await prisma.walletTransaction.create({
    data: {
      id: randomBytes(16).toString("hex"),
      userId: user.id,
      amount: 500,
      type: "SIGNUP_BONUS",
      balanceAfter: 500,
      description: "Welcome bonus",
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

  const tokens = await createTokens(user.id, user.email, false);

  return {
    user: { id: user.id, email: user.email, username: user.username, referralCode, avatarUrl: user.avatarUrl, bio: user.bio, walletBalance: user.walletBalance, isEmailVerified: user.isEmailVerified, twoFactorEnabled: user.twoFactorEnabled, preferences: user.preferences, createdAt: user.createdAt, isAdmin: false },
    tokens,
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw unauthorized("Invalid credentials");

  const valid = await verify(user.passwordHash, input.password);
  if (!valid) throw unauthorized("Invalid credentials");

  if (user.isBanned) throw unauthorized("This account has been banned");

  if (user.twoFactorEnabled) {
    return { requires2FA: true as const, userId: user.id };
  }

  // Daily login bonus (50 SC, once per UTC day)
  let dailyBonusAwarded = false;
  const today = new Date().toISOString().slice(0, 10);
  const lastBonus = user.lastDailyBonus?.toISOString().slice(0, 10);
  if (lastBonus !== today) {
    const newBalance = Number(user.walletBalance) + 50;
    await prisma.user.update({
      where: { id: user.id },
      data: { walletBalance: newBalance, lastDailyBonus: new Date() },
    });
    await prisma.walletTransaction.create({
      data: {
        id: randomBytes(16).toString("hex"),
        userId: user.id,
        amount: 50,
        type: "DAILY_BONUS",
        balanceAfter: newBalance,
        description: "Daily login bonus",
      },
    });
    dailyBonusAwarded = true;
    user.walletBalance = newBalance as any;
  }

  const tokens = await createTokens(user.id, user.email, user.isAdmin);

  return {
    requires2FA: false as const,
    dailyBonusAwarded,
    user: { id: user.id, email: user.email, username: user.username, isStudent: user.isStudent, referralCode: user.referralCode, avatarUrl: user.avatarUrl, bio: user.bio, walletBalance: user.walletBalance, isEmailVerified: user.isEmailVerified, twoFactorEnabled: user.twoFactorEnabled, preferences: user.preferences, createdAt: user.createdAt, isAdmin: user.isAdmin },
    tokens,
  };
}

export async function refreshTokens(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) throw unauthorized("Invalid refresh token");

  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { isAdmin: true, isBanned: true } });
  if (user?.isBanned) throw unauthorized("This account has been banned");
  return createTokens(payload.userId, payload.email, user?.isAdmin ?? false);
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
      preferences: true, isAdmin: true,
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

export async function createTokens(userId: string, email: string, isAdmin = false) {
  // Delete existing refresh tokens for this user to avoid unique constraint conflicts
  await prisma.refreshToken.deleteMany({ where: { userId } });

  const accessToken = signAccessToken({ userId, email, isAdmin });
  const refreshToken = signRefreshToken({ userId, email, isAdmin });

  await prisma.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken };
}
