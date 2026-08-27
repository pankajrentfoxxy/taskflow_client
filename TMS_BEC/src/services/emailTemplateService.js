import config from "../config/config.js";

function layout({ title, bodyHtml, previewText, footerText }) {
  const appName = config.app.name;
  const footer =
    footerText ||
    `If you did not request this, you can ignore this email. This code expires in ${config.otp.expiryMinutes} minutes.`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${previewText || title}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="padding:24px 28px 8px;text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:12px;background:#18181b;color:#fff;font-weight:800;font-size:16px;">TF</div>
              <h1 style="margin:16px 0 0;font-size:20px;color:#18181b;">${appName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;color:#3f3f46;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#fafafa;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:1.5;">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function passwordResetOtpTemplate({ userName, otp }) {
  const greeting = userName ? `Hi ${userName},` : "Hi,";
  const bodyHtml = `
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 20px;">Use the verification code below to reset your ${config.app.name} password:</p>
    <div style="margin:0 0 20px;padding:16px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;text-align:center;">
      <span style="display:block;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#b91c1c;margin-bottom:8px;">Your OTP</span>
      <span style="font-size:32px;font-weight:800;letter-spacing:0.35em;color:#18181b;">${otp}</span>
    </div>
    <p style="margin:0;">Enter this code on the password reset screen. Do not share it with anyone.</p>
  `;

  const subject = `${config.app.name} password reset code: ${otp}`;
  const html = layout({
    title: "Password reset",
    previewText: `Your password reset code is ${otp}`,
    bodyHtml,
  });
  const text = `${greeting}\n\nYour ${config.app.name} password reset code is: ${otp}\n\nThis code expires in ${config.otp.expiryMinutes} minutes.`;

  return { subject, html, text };
}

export function ceoDailyReportEmail({ dateKey, taskCount, summary }) {
  const appName = config.app.name;
  const attention =
    (summary?.overdue || 0) +
    (summary?.noResponse || 0) +
    (summary?.escalatedAwaiting || 0) +
    (summary?.escalatedPendingReview || 0);

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi,</p>
    <p style="margin:0 0 16px;">Your daily ${appName} report for <strong>${dateKey}</strong> is attached.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;border-collapse:collapse;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;">Open tasks</td><td align="right" style="padding:8px 0;border-bottom:1px solid #e4e4e7;font-weight:700;">${summary?.open ?? "—"}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#dc2626;">Need attention</td><td align="right" style="padding:8px 0;border-bottom:1px solid #e4e4e7;font-weight:700;color:#dc2626;">${attention}</td></tr>
      <tr><td style="padding:8px 0;">Tasks in attachment</td><td align="right" style="padding:8px 0;font-weight:700;">${taskCount}</td></tr>
    </table>
    <p style="margin:0;">The Excel file has two sheets: <strong>Report</strong> (summary) and <strong>Tasks</strong> (open tasks).</p>
  `;

  const subject = `${appName} daily report — ${dateKey}`;
  const html = layout({
    title: "Daily report",
    previewText: `${appName} daily report for ${dateKey}`,
    bodyHtml,
    footerText: "This automated report is sent once daily at 9:00 PM IST.",
  });
  const text = `Your ${appName} daily report for ${dateKey} is attached.\nOpen tasks: ${summary?.open ?? "—"}\nNeed attention: ${attention}\nTasks in attachment: ${taskCount}`;

  return { subject, html, text };
}

function roleIntro(role) {
  switch (role) {
    case "COLLABORATOR":
      return "You have been added as a <strong>collaborator</strong> on a new task.";
    case "WATCHER":
      return "You have been added as a <strong>watcher</strong> on a new task.";
    default:
      return "A new task has been <strong>assigned to you</strong>.";
  }
}

export function taskCreatedEmailTemplate({
  userName,
  role = "ASSIGNEE",
  taskTitle,
  taskTitles = [],
  dueAt,
  creatorName,
  taskUrl,
}) {
  const greeting = userName ? `Hi ${userName},` : "Hi,";
  const intro = roleIntro(role);
  const titles =
    taskTitles.length > 1
      ? `<ul style="margin:12px 0 0;padding-left:20px;">${taskTitles.map((t) => `<li style="margin:4px 0;">${t}</li>`).join("")}</ul>`
      : `<p style="margin:12px 0 0;font-weight:700;color:#18181b;">${taskTitle}</p>`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 8px;">${intro}</p>
    ${titles}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;border-collapse:collapse;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#71717a;">Created by</td><td align="right" style="padding:8px 0;border-bottom:1px solid #e4e4e7;font-weight:600;">${creatorName || "—"}</td></tr>
      <tr><td style="padding:8px 0;color:#71717a;">Due</td><td align="right" style="padding:8px 0;font-weight:600;">${dueAt || "—"}</td></tr>
    </table>
    <p style="margin:24px 0 0;text-align:center;">
      <a href="${taskUrl}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;">Open task</a>
    </p>
  `;

  const subject =
    taskTitles.length > 1
      ? `${config.app.name}: ${taskTitles.length} new tasks`
      : `${config.app.name}: New task — ${taskTitle}`;

  const html = layout({
    title: "New task",
    previewText: taskTitles.length > 1 ? `${taskTitles.length} new tasks assigned` : `New task: ${taskTitle}`,
    bodyHtml,
    footerText: `You received this because you are involved in this task on ${config.app.name}.`,
  });

  const text = `${greeting}\n\n${intro.replace(/<[^>]+>/g, "")}\n\n${
    taskTitles.length > 1 ? taskTitles.map((t) => `- ${t}`).join("\n") : taskTitle
  }\n\nCreated by: ${creatorName || "—"}\nDue: ${dueAt || "—"}\n\nOpen: ${taskUrl}`;

  return { subject, html, text };
}

export default { passwordResetOtpTemplate, ceoDailyReportEmail, taskCreatedEmailTemplate };
