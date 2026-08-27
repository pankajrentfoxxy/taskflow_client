import crypto from "crypto";
import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import { Op } from "sequelize";
import config from "../config/config.js";
import logger from "../config/logger.js";
import { User, Otp } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { now } from "../lib/time.js";
import { sendMail } from "./mailService.js";
import { passwordResetOtpTemplate } from "./emailTemplateService.js";

const PURPOSE_PASSWORD_RESET = "PASSWORD_RESET";
const MAX_ATTEMPTS = 5;

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export async function createAndSendPasswordResetOtp(email) {
  const normalized = String(email).toLowerCase().trim();
  const user = await User.findOne({ where: { email: normalized, is_active: true } });

  // Always respond the same way — do not reveal whether the email exists.
  const genericResponse = {
    ok: true,
    message: "If an account exists for this email, a verification code has been sent.",
  };

  if (!user) return genericResponse;

  const code = generateOtpCode();
  const expiresAt = now() + config.otp.expiryMinutes * 60 * 1000;
  const ts = now();

  await Otp.update({ used_at: ts }, { where: { email: normalized, purpose: PURPOSE_PASSWORD_RESET, used_at: null } });

  await Otp.create({
    email: normalized,
    purpose: PURPOSE_PASSWORD_RESET,
    code_hash: bcrypt.hashSync(code, 10),
    expires_at: expiresAt,
    created_at: ts,
  });

  const template = passwordResetOtpTemplate({ userName: user.name, otp: code });
  setImmediate(() => {
    sendMail({
      to: normalized,
      subject: template.subject,
      html: template.html,
      text: template.text,
    }).catch((err) => {
      logger.error(`Failed to send password reset OTP to ${normalized}: ${err.message}`);
    });
  });

  return genericResponse;
}

export async function verifyPasswordResetOtp(email, otp) {
  const normalized = String(email).toLowerCase().trim();
  const code = String(otp || "").trim();

  if (!/^\d{6}$/.test(code)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Enter a valid 6-digit code");
  }

  const row = await Otp.findOne({
    where: {
      email: normalized,
      purpose: PURPOSE_PASSWORD_RESET,
      used_at: null,
      expires_at: { [Op.gt]: now() },
    },
    order: [["id", "DESC"]],
  });

  if (!row) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired verification code");
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    throw new ApiError(httpStatus.TOO_MANY_REQUESTS, "Too many attempts. Request a new code.");
  }

  const valid = bcrypt.compareSync(code, row.code_hash);
  if (!valid) {
    await row.update({ attempts: row.attempts + 1 });
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired verification code");
  }

  return row;
}

export async function consumePasswordResetOtp(otpRow) {
  await otpRow.update({ used_at: now() });
}

export default { createAndSendPasswordResetOtp, verifyPasswordResetOtp, consumePasswordResetOtp };
