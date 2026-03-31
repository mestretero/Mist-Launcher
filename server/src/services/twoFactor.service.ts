import { generateSecret, generateURI, verify as otpVerify } from "otplib";
import QRCode from "qrcode";
import { prisma } from "../lib/prisma.js";

export async function generateSetup(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const secret = generateSecret();
  const otpauth = generateURI({
    issuer: "MIST",
    label: user.email,
    secret,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
  return { qrCodeDataUrl, secret };
}

export async function verifyAndEnable(userId: string, token: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.twoFactorSecret) throw new Error("2FA setup not initiated");
  const isValid = otpVerify({ token, secret: user.twoFactorSecret });
  if (!isValid) throw new Error("Invalid 2FA code");
  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
  return { enabled: true };
}

export async function verifyToken(userId: string, token: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.twoFactorSecret) return false;
  return otpVerify({ token, secret: user.twoFactorSecret });
}

export async function disable(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  return { enabled: false };
}
