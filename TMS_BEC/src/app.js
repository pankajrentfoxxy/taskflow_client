import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import xss from "xss-clean";
import passport from "passport";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import httpStatus from "http-status";

import config from "./config/config.js";
import morgan from "./config/morgan.js";
import { jwtStrategy } from "./config/passport.js";
import routes from "./routes.js";
import { errorConverter, errorHandler } from "./middlewares/error.js";
import ApiError from "./utils/ApiError.js";
import {
  sequelize,
  Meta,
  Team,
  User,
  TaskType,
  Project,
  ProjectMember,
  ProjectNote,
  Board,
  Task,
  Comment,
  CommentReaction,
  Activity,
  Escalation,
  Notification,
  Attachment,
  Otp,
  TaskMember,
  ChatConversation,
  ChatMessage,
  ChatMessageReaction,
  ChatGroupMember,
} from "./models/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadPath = path.isAbsolute(config.uploadDir)
  ? config.uploadDir
  : path.join(__dirname, "..", config.uploadDir);

fs.mkdirSync(uploadPath, { recursive: true });

const app = express();

if (config.env === "production") {
  app.set("trust proxy", 1);
}

if (config.env !== "test") {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(xss());
app.use(compression());

passport.use(jwtStrategy);
app.use(passport.initialize());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "taskflow-api" });
});

app.use("/api", routes);

app.use((_req, _res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, "Not found"));
});

app.use(errorConverter);
app.use(errorHandler);

const syncModels = async () => {
  await sequelize.authenticate();
  // Order respects FK dependencies (users/teams have no cross-FK — see models/index.js).
  await Meta.sync();
  await User.sync();
  await Team.sync();
  await TaskType.sync();
  await Project.sync();
  await Board.sync();
  await ProjectMember.sync();
  await ProjectNote.sync();
  await Task.sync();
  await Comment.sync();
  await CommentReaction.sync();
  await Activity.sync();
  await Escalation.sync();
  await Notification.sync();
  await Otp.sync();
  await TaskMember.sync();
  await ChatConversation.sync();
  await ChatGroupMember.sync();
  await ChatMessage.sync();
  await ChatMessageReaction.sync();
  await Attachment.sync();
};

export const initApp = async () => {
  await syncModels();
  const userCount = await User.count();
  if (userCount === 0) {
    const { seedDatabase } = await import("../scripts/seed.js");
    await seedDatabase();
  }
};

export default app;
