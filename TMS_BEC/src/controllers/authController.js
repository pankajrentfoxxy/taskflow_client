import httpStatus from "http-status";
import config from "../config/config.js";
import catchAsync from "../utils/catchAsync.js";
import * as authService from "../services/authService.js";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: config.env === "production",
};

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie("accessToken", accessToken, {
    ...cookieBase,
    maxAge: config.jwt.accessExpirationMinutes * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieBase,
    maxAge: config.jwt.refreshExpirationDays * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res) {
  const clearOpts = { path: "/", secure: config.env === "production" };
  res.clearCookie("accessToken", clearOpts);
  res.clearCookie("refreshToken", clearOpts);
}

export const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password);
  setAuthCookies(res, result);
  res.json(result);
});

export const refresh = catchAsync(async (req, res) => {
  const result = await authService.refreshSession(req.cookies?.refreshToken);
  setAuthCookies(res, result);
  res.json({ ok: true });
});

export const logout = catchAsync(async (_req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

export const forgotPassword = catchAsync(async (req, res) => {
  res.json(await authService.requestPasswordResetOtp(req.body.email));
});

export const resetPassword = catchAsync(async (req, res) => {
  res.json(await authService.resetPassword(req.body));
});

export default { login, refresh, logout, resetPassword, forgotPassword };
