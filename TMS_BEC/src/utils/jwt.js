import jwt from "jsonwebtoken";
import config from "../config/config.js";

export const signToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: `${config.jwt.accessExpirationMinutes}m`,
  });
};

export const signRefreshToken = (userId) => {
  return jwt.sign({ userId, type: "refresh" }, config.jwt.secret, {
    expiresIn: `${config.jwt.refreshExpirationDays}d`,
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

export const verifyRefreshToken = (token) => {
  const payload = jwt.verify(token, config.jwt.secret);
  if (payload?.type !== "refresh") {
    throw new Error("Invalid refresh token");
  }
  return payload;
};

export default { signToken, signRefreshToken, verifyToken, verifyRefreshToken };
