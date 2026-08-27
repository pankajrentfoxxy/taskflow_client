import { Op } from "sequelize";
import config from "../config/config.js";
import logger from "../config/logger.js";
import { User, Team } from "../models/index.js";
import { sendMail } from "./mailService.js";
import { taskCreatedEmailTemplate } from "./emailTemplateService.js";

function appBaseUrl() {
  const origin = config.corsOrigin?.[0] || "http://localhost:6070";
  return origin.replace(/\/$/, "");
}

function fmtDue(dueAt) {
  if (dueAt == null || dueAt === "") return "";
  return new Date(Number(dueAt)).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function sendTaskCreatedEmailsAsync({
  taskId,
  titles,
  dueAt,
  creatorName,
  creatorId,
  assigneeId,
  teamId,
  memberEntries = [],
}) {
  const recipients = new Map();

  if (assigneeId) {
    recipients.set(Number(assigneeId), "ASSIGNEE");
  }

  for (const { userId, role } of memberEntries) {
    if (!recipients.has(userId)) {
      recipients.set(userId, role);
    }
  }

  if (teamId) {
    const members = await User.findAll({
      where: { team_id: teamId, is_active: true },
      attributes: ["id"],
    });
    const team = await Team.findByPk(teamId, { attributes: ["manager_id"] });
    for (const id of [...members.map((m) => m.id), team?.manager_id].filter(Boolean)) {
      if (!recipients.has(id)) recipients.set(id, "ASSIGNEE");
    }
  }

  if (creatorId) recipients.delete(Number(creatorId));
  if (recipients.size === 0) return;

  const users = await User.findAll({
    where: { id: { [Op.in]: [...recipients.keys()] }, is_active: true },
    attributes: ["id", "name", "email"],
  });

  const taskUrl = `${appBaseUrl()}/tasks/${taskId}`;
  const dueLabel = fmtDue(dueAt);
  const primaryTitle = titles[0] || "New task";
  const titleLabel = titles.length > 1 ? `${titles.length} new tasks` : primaryTitle;

  for (const user of users) {
    if (!user.email) continue;
    const role = recipients.get(user.id) || "ASSIGNEE";
    const template = taskCreatedEmailTemplate({
      userName: user.name,
      role,
      taskTitle: titleLabel,
      taskTitles: titles,
      dueAt: dueLabel,
      creatorName,
      taskUrl,
    });

    await sendMail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }
}

/** Fire-and-forget emails when a task is created. */
export function sendTaskCreatedEmails(params) {
  setImmediate(() => {
    sendTaskCreatedEmailsAsync(params).catch((err) => {
      logger.error(`Task created email batch failed: ${err.message}`);
    });
  });
}

export default { sendTaskCreatedEmails };
