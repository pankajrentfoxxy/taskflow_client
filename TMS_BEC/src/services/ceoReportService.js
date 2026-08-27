import httpStatus from "http-status";
import Meta from "../models/Meta.js";
import User from "../models/User.js";
import config from "../config/config.js";
import logger from "../config/logger.js";
import ApiError from "../utils/ApiError.js";
import { buildReportsWorkbook } from "../lib/reportsExcel.js";
import { getReports } from "./reportsService.js";
import { listTasks } from "./taskService.js";
import { sendMail } from "./mailService.js";
import { ceoDailyReportEmail } from "./emailTemplateService.js";

export function istDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.ceoReport.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function fetchAllOpenTasks(ceoUser) {
  const all = [];
  let page = 1;
  let totalPages = 1;

  do {
    const { tasks, pagination } = await listTasks(ceoUser, {
      filter: "all",
      page,
      limit: 100,
    });
    all.push(...tasks);
    totalPages = pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages && page <= 100);

  return all;
}

async function findActiveCeos() {
  const ceos = await User.findAll({
    where: { role: "CEO", is_active: true },
    order: [["id", "ASC"]],
  });
  return ceos.map((user) => user.get({ plain: true }));
}

async function buildCeoReportPackage(reportUser) {
  const dateKey = istDateKey();
  const reportData = await getReports(reportUser, { days: 0 });
  const tasks = await fetchAllOpenTasks(reportUser);
  const buffer = await buildReportsWorkbook({ reportData, tasks });
  const filename = `taskflow-reports-${dateKey}.xlsx`;
  const { subject, html, text } = ceoDailyReportEmail({
    dateKey,
    taskCount: tasks.length,
    summary: reportData.summary,
  });

  return { dateKey, filename, buffer, subject, html, text, taskCount: tasks.length, reportData };
}

export async function runDailyCeoReport({ trigger = "manual", force = false } = {}) {
  if (config.env !== "production") {
    return { skipped: true, reason: "not_production" };
  }

  const dateKey = istDateKey();
  const metaKey = `ceo_daily_report_${dateKey}`;

  if (!force) {
    const sent = await Meta.findByPk(metaKey);
    if (sent) {
      return { skipped: true, reason: "already_sent", dateKey };
    }
  }

  if (!force) {
    try {
      await Meta.create({ key: metaKey, value: String(Date.now()) });
    } catch {
      return { skipped: true, reason: "already_sent", dateKey };
    }
  }

  const ceos = await findActiveCeos();
  const recipients = ceos
    .map((user) => user.email)
    .filter((email) => typeof email === "string" && email.trim());

  if (recipients.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, "No active CEO user with an email found");
  }

  const pkg = await buildCeoReportPackage(ceos[0]);

  for (const email of recipients) {
    await sendMail({
      to: email,
      subject: pkg.subject,
      html: pkg.html,
      text: pkg.text,
      attachments: [
        {
          filename: pkg.filename,
          content: Buffer.from(pkg.buffer),
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });
  }

  logger.info(`CEO daily report emailed to ${recipients.join(", ")} for ${pkg.dateKey} (${trigger})`);
  return { ok: true, dateKey: pkg.dateKey, recipients, taskCount: pkg.taskCount };
}

export default { runDailyCeoReport, istDateKey };
