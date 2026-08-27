import nodemailer from "nodemailer";
import config from "../config/config.js";
import logger from "../config/logger.js";

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.smtp.host) return null;

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user
      ? {
          user: config.smtp.user,
          pass: config.smtp.pass,
        }
      : undefined,
  });
  return transporter;
}

export async function sendMail({ to, subject, html, text, attachments }) {
  const transport = getTransporter();

  if (!transport) {
    logger.warn(`Email not sent (SMTP not configured). To: ${to}, Subject: ${subject}`);
    if (config.env === "development" && text) {
      logger.info(`[DEV EMAIL]\n${text}`);
    }
    return { ok: true, devMode: true };
  }

  const info = await transport.sendMail({
    from: config.smtp.from,
    to,
    subject,
    html,
    text,
    attachments,
  });

  logger.info(`Email sent to ${to}: ${info.messageId}`);
  return { ok: true, messageId: info.messageId };
}

export default { sendMail };
