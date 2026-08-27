import express from "express";
import authRoutes from "./routes/auth.routes.js";
import meRoutes from "./routes/me.routes.js";
import usersRoutes from "./routes/users.routes.js";
import teamsRoutes from "./routes/teams.routes.js";
import taskTypesRoutes from "./routes/taskTypes.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import uploadsRoutes from "./routes/uploads.routes.js";
import boardsRoutes from "./routes/boards.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import cronRoutes from "./routes/cron.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import sqlRoutes from "./routes/sql.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/me", meRoutes);
router.use("/users", usersRoutes);
router.use("/teams", teamsRoutes);
router.use("/task-types", taskTypesRoutes);
router.use("/tasks", tasksRoutes);
router.use("/projects", projectsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/uploads", uploadsRoutes);
router.use("/boards", boardsRoutes);
router.use("/reports", reportsRoutes);
router.use("/cron", cronRoutes);
router.use("/chat", chatRoutes);
router.use("/sql", sqlRoutes);

export default router;
