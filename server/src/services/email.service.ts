import nodemailer from "nodemailer";
import { Resend } from "resend";

// ─── Transport layer ───────────────────────────────────────────────────────────

const FROM = process.env.EMAIL_FROM || "MIST <noreply@mist.com>";

// Resend (production)
let resend: Resend | null = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log("Email: using Resend API");
}

// Nodemailer fallback (dev)
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
    console.log("Email dev: https://ethereal.email/login");
    console.log(`User: ${testAccount.user}`);
  }
  return transporter;
}

async function sendMail(to: string, subject: string, html: string) {
  if (resend) {
    await resend.emails.send({ from: FROM, to, subject, html });
  } else {
    const mailer = await getTransporter();
    await mailer.sendMail({ from: FROM, to, subject, html });
  }
}

// ─── Email templates ───────────────────────────────────────────────────────────

function wrapTemplate(content: string, previewText = "") {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>MIST</title>
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>` : ""}
</head>
<body style="margin:0;padding:0;background:#080a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080a0f;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${process.env.API_URL || "https://api.mistlauncher.com"}/public/mist-logo.png" alt="MIST" width="36" height="36" style="display:block;border-radius:8px;" />
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:17px;font-weight:900;letter-spacing:0.22em;">MIST</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#0d1018;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;">

              <!-- Top accent line -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:2px;background:linear-gradient(90deg,transparent,#1a9fff,transparent);"></td>
                </tr>
              </table>

              <!-- Content -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:36px 36px 32px;">
                    ${content}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;color:#2a3040;font-size:11px;line-height:1.6;">
                Bu e-postayı sen talep etmediysen güvenle yok sayabilirsin.<br/>
                &copy; 2026 MIST &mdash; <a href="https://mistlauncher.com" style="color:#2a3040;text-decoration:none;">mistlauncher.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmailVerification(to: string, code: string) {
  const digits = code.split("");
  const html = wrapTemplate(`
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">E-posta Doğrulama</p>
    <p style="margin:0 0 28px;font-size:14px;color:#5e6e80;line-height:1.6;">
      Hesabını doğrulamak için aşağıdaki 6 haneli kodu MIST uygulamasına gir.
    </p>

    <!-- OTP block -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;background:#070910;border:1px solid rgba(26,159,255,0.15);border-radius:12px;padding:24px 32px;">
      <tr>
        ${digits.map((d) => `<td style="padding:0 5px;"><span style="font-size:38px;font-weight:900;color:#1a9fff;font-family:'Courier New',Courier,monospace;letter-spacing:2px;">${d}</span></td>`).join("")}
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#3d4755;text-align:center;">
      &#x23F1; Bu kod <strong style="color:#4a5a6a;">10 dakika</strong> geçerlidir.
    </p>
  `, `MIST doğrulama kodun: ${code}`);
  await sendMail(to, "MIST — Doğrulama Kodun", html);
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:1420"}/reset-password?token=${token}`;
  const html = wrapTemplate(`
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Şifre Sıfırlama</p>
    <p style="margin:0 0 28px;font-size:14px;color:#5e6e80;line-height:1.6;">
      Hesabın için şifre sıfırlama talebinde bulundun. Aşağıdaki butona tıklayarak devam edebilirsin.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td align="center">
          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#1a9fff,#0066cc);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.04em;">
            Şifremi Sıfırla
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 4px;font-size:12px;color:#3d4755;text-align:center;">
      &#x23F1; Bu bağlantı <strong style="color:#4a5a6a;">1 saat</strong> geçerlidir.
    </p>
    <p style="margin:0;font-size:11px;color:#2a3040;text-align:center;">
      Bu işlemi sen gerçekleştirmediysen e-postayı yok sayabilirsin.
    </p>
  `, "MIST şifre sıfırlama bağlantın hazır");
  await sendMail(to, "MIST — Şifre Sıfırlama", html);
}
