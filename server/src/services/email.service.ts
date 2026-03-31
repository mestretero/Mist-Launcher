import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter;

async function getTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log("Email test: https://ethereal.email/login");
    console.log(`User: ${testAccount.user}`);
  }
  return transporter;
}

const FROM = process.env.SMTP_FROM || "noreply@mist.com";

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:1420"}/reset-password?token=${token}`;
  const mailer = await getTransporter();
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "MIST - Şifre Sıfırlama",
    html: `<h2>Şifre Sıfırlama</h2><p>Şifrenizi sıfırlamak için tıklayın:</p><a href="${resetUrl}">${resetUrl}</a><p>1 saat geçerlidir.</p>`,
  });
}

export async function sendEmailVerification(to: string, token: string) {
  const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:1420"}/verify-email?token=${token}`;
  const mailer = await getTransporter();
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "MIST - Email Doğrulama",
    html: `<h2>Email Doğrulama</h2><p>Hesabınızı doğrulamak için tıklayın:</p><a href="${verifyUrl}">${verifyUrl}</a>`,
  });
}
