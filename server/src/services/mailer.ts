// ============================================================
// Gmail SMTP sender using nodemailer + user's app password.
// Designed for low volume (review-and-send), not transactional.
// ============================================================

import nodemailer from "nodemailer";

export interface SmtpConfig {
  user: string;
  appPassword: string;
  fromName: string | null;
}

export function makeTransport(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: cfg.user, pass: cfg.appPassword.replace(/\s+/g, "") },
  });
}

export async function sendEmail(
  cfg: SmtpConfig,
  msg: { to: string; subject: string; text: string }
): Promise<{ messageId: string }> {
  const t = makeTransport(cfg);
  const from = cfg.fromName ? `"${cfg.fromName}" <${cfg.user}>` : cfg.user;
  const info = await t.sendMail({
    from,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
  });
  return { messageId: info.messageId };
}
