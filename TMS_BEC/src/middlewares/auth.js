import passport from "passport";
import httpStatus from "http-status";
import ApiError from "../utils/ApiError.js";

const verifyCallback = (req, resolve, reject) => (err, user, info) => {
  if (err || info || !user) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, "Please authenticate"));
  }
  req.user = user;
  resolve();
};

const auth =
  (...requiredRights) =>
  async (req, res, next) => {
    return new Promise((resolve, reject) => {
      passport.authenticate("jwt", { session: false }, verifyCallback(req, resolve, reject))(
        req,
        res,
        next
      );
    })
      .then(() => {
        if (requiredRights.length) {
          const hasRights = requiredRights.some((right) => req.user?.role === right);
          if (!hasRights) {
            return next(new ApiError(httpStatus.FORBIDDEN, "Forbidden"));
          }
        }
        return next();
      })
      .catch((err) => next(err));
  };

export default auth;
