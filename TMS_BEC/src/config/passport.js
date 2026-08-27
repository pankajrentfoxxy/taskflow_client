import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import config from "./config.js";
import { User } from "../models/index.js";

const cookieExtractor = (req) => req?.cookies?.accessToken || null;

const jwtOptions = {
  secretOrKey: config.jwt.secret,
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    cookieExtractor,
  ]),
};

const jwtVerify = async (payload, done) => {
  try {
    const userId = payload?.userId ?? payload?.user_id;
    if (!userId) return done(null, false);
    const user = await User.findOne({
      where: { id: userId, is_active: true },
      attributes: ["id", "name", "email", "role", "team_id", "is_active"],
    });
    if (!user) return done(null, false);
    return done(null, user.get({ plain: true }));
  } catch (err) {
    return done(err, false);
  }
};

export const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);
