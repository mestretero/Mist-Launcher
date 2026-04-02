import { hash, verify } from "argon2";
import { randomBytes, createHmac } from "crypto";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { conflict, unauthorized, badRequest, notFound } from "../lib/errors.js";
import { sendPasswordResetEmail, sendEmailVerification } from "./email.service.js";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema.js";

function generateReferralCode(username: string): string {
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `${username.toUpperCase()}-${suffix}`;
}

function generateEmailOTP(): string {
  const num = (parseInt(randomBytes(3).toString("hex"), 16) % 900000) + 100000;
  return num.toString();
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
  });
  if (existing) throw conflict("Email or username already exists");

  // Resolve referrer if a referral code was provided
  let referrerId: string | undefined;
  if (input.referralCode) {
    const referral = await prisma.referral.findUnique({
      where: { code: input.referralCode },
      select: { ownerId: true },
    });
    if (referral) referrerId = referral.ownerId;
  }

  const passwordHash = await hash(input.password);
  const referralCode = generateReferralCode(input.username);
  const startingBalance = referrerId ? 1000 : 500; // bonus for using a referral code

  const emailVerifyToken = generateEmailOTP();
  const emailVerifyExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      referralCode,
      referredBy: referrerId ?? null,
      emailVerifyToken,
      emailVerifyExpiry,
      walletBalance: startingBalance,
    },
  });

  // Signup bonus transaction
  await prisma.walletTransaction.create({
    data: {
      id: randomBytes(16).toString("hex"),
      userId: user.id,
      amount: startingBalance,
      type: "SIGNUP_BONUS",
      balanceAfter: startingBalance,
      description: referrerId ? "Welcome bonus + referral bonus" : "Welcome bonus",
    },
  });

  // Reward the referrer (atomic transaction)
  if (referrerId) {
    await prisma.$transaction(async (tx) => {
      const referrer = await tx.user.update({
        where: { id: referrerId },
        data: { walletBalance: { increment: 250 } },
      });
      await tx.walletTransaction.create({
        data: {
          id: randomBytes(16).toString("hex"),
          userId: referrerId,
          amount: 250,
          type: "REFERRAL_EARNING",
          balanceAfter: referrer.walletBalance,
          description: `Referral bonus — ${input.username} joined`,
        },
      });
    });
  }

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

export async function loginUser(input: LoginInput & { deviceId?: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw unauthorized("Invalid credentials");

  const valid = await verify(user.passwordHash, input.password);
  if (!valid) throw unauthorized("Invalid credentials");

  if (user.isBanned) throw unauthorized("This account has been banned");

  if (!user.isEmailVerified) throw unauthorized("Please verify your email before logging in");

  if (user.twoFactorEnabled) {
    // Skip 2FA if device is trusted
    if (input.deviceId) {
      const hashedId = hashDeviceId(user.id, input.deviceId);
      const trusted = await prisma.trustedDevice.findUnique({
        where: { userId_deviceId: { userId: user.id, deviceId: hashedId } },
      });
      if (trusted) {
        await prisma.trustedDevice.update({ where: { id: trusted.id }, data: { lastUsed: new Date() } });
        // Fall through to normal login (skip 2FA)
      } else {
        return { requires2FA: true as const, userId: user.id };
      }
    } else {
      return { requires2FA: true as const, userId: user.id };
    }
  }

  // Daily login bonus (50 MC, once per UTC day)
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

  // Atomic: find, validate, and delete old token in one transaction
  const user = await prisma.$transaction(async (tx) => {
    const stored = await tx.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) throw unauthorized("Invalid refresh token");

    await tx.refreshToken.deleteMany({ where: { userId: payload.userId } });

    const u = await tx.user.findUnique({ where: { id: payload.userId }, select: { isAdmin: true, isBanned: true } });
    if (u?.isBanned) throw unauthorized("This account has been banned");
    return u;
  });

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

export async function updateProfile(userId: string, data: { bio?: string; avatarUrl?: string; username?: string }) {
  if (data.username) {
    const taken = await prisma.user.findUnique({ where: { username: data.username } });
    if (taken && taken.id !== userId) {
      throw conflict("Username is already taken");
    }
  }
  return prisma.user.update({
    where: { id: userId },
    data: { bio: data.bio, avatarUrl: data.avatarUrl, username: data.username },
    select: {
      id: true, email: true, username: true, bio: true, avatarUrl: true,
      isStudent: true, referralCode: true, walletBalance: true, isEmailVerified: true, twoFactorEnabled: true,
      preferences: true,
    },
  });
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { sent: true }; // Don't reveal if email exists

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
  // Atomically find AND invalidate token to prevent reuse
  const user = await prisma.user.findFirst({
    where: { passwordResetToken: token },
  });
  if (!user) throw badRequest("Invalid or expired token");
  if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
    throw badRequest("Invalid or expired token");
  }

  // Invalidate token first, then update password
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: null, passwordResetExpiry: null },
  });

  const passwordHash = await hash(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return { reset: true };
}

export async function verifyEmail(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User not found");
  if (user.isEmailVerified) throw badRequest("Email already verified");
  if (!user.emailVerifyToken || user.emailVerifyToken !== code) throw badRequest("Invalid code");
  if (!user.emailVerifyExpiry || user.emailVerifyExpiry < new Date()) throw badRequest("Code expired — request a new one");

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifyToken: null, emailVerifyExpiry: null },
  });

  return { verified: true };
}

export async function resendEmailVerification(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User not found");
  if (user.isEmailVerified) throw badRequest("Email already verified");

  const code = generateEmailOTP();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifyToken: code, emailVerifyExpiry: expiry },
  });

  sendEmailVerification(user.email, code).catch((err) =>
    console.error("Failed to send verification email:", err),
  );

  return { sent: true };
}

function hashDeviceId(userId: string, deviceId: string): string {
  const secret = process.env.JWT_SECRET!;
  return createHmac("sha256", secret).update(`${userId}:${deviceId}`).digest("hex");
}

export async function trustDevice(userId: string, deviceId: string, label?: string) {
  const hashedId = hashDeviceId(userId, deviceId);
  await prisma.trustedDevice.upsert({
    where: { userId_deviceId: { userId, deviceId: hashedId } },
    update: { lastUsed: new Date(), label: label || undefined },
    create: { userId, deviceId: hashedId, label },
  });
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

export async function logout(userId: string) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
  return { loggedOut: true };
}
