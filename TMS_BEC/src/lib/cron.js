import { Op } from "sequelize";
import { Task, Escalation, Meta } from "../models/index.js";
import { now } from "./time.js";
import { notify, managerOf, ceoIds, logActivity } from "./notify.js";

/**
 * SLA sweep: flags response-SLA breaches, sends 15-min warnings, escalates
 * overdue tasks. Runs at most once per minute unless forced.
 */
export async function runSlaSweep(force = false) {
  const t = now();
  const lastRow = await Meta.findByPk("last_sweep");
  const last = lastRow?.value;

  if (!force && last && t - Number(last) < 60_000) {
    return { breached: 0, warned: 0, escalated: 0 };
  }

  await Meta.upsert({ key: "last_sweep", value: String(t) });

  let breached = 0;
  let warned = 0;
  let escalated = 0;

  // 1) Response-SLA breaches (assigned, never acknowledged, deadline passed)
  const toBreach = await Task.findAll({
    where: {
      deleted: false,
      status: "ASSIGNED",
      acknowledged_at: null,
      sla_deadline_at: { [Op.lt]: t },
      sla_breached_at: null,
    },
  });

  for (const task of toBreach) {
    await task.update({ sla_breached_at: t, updated_at: t });
    await logActivity(task.id, null, "SLA_BREACH", {});
    await notify(
      [task.assignee_id, await managerOf(task.assignee_id), task.creator_id],
      "SLA_BREACH",
      `No response: "${task.title}"`,
      "Task was not accepted within 30 working minutes.",
      task.id
    );
    breached++;
  }

  // 2) 15-minutes-left warnings
  const toWarn = await Task.findAll({
    where: {
      deleted: false,
      status: "ASSIGNED",
      acknowledged_at: null,
      warn_sent: false,
      sla_breached_at: null,
      sla_deadline_at: {
        [Op.gt]: t,
        [Op.lte]: t + 15 * 60 * 1000,
      },
    },
  });

  for (const task of toWarn) {
    await task.update({ warn_sent: true });
    await notify(
      [task.assignee_id],
      "SLA_WARNING",
      `15 minutes left to accept "${task.title}"`,
      "",
      task.id
    );
    warned++;
  }

  // 3) Escalate past-due open tasks
  const toEscalate = await Task.findAll({
    where: {
      deleted: false,
      status: { [Op.notIn]: ["DONE", "CANCELLED", "ESCALATED"] },
      due_at: { [Op.lt]: t },
    },
  });

  for (const task of toEscalate) {
    await task.update({ status: "ESCALATED", escalated_at: t, updated_at: t });
    await Escalation.create({ task_id: task.id, created_at: t });
    await logActivity(task.id, null, "ESCALATED", { dueAt: task.due_at });
    await notify(
      [
        task.assignee_id,
        await managerOf(task.assignee_id),
        task.creator_id,
        ...(await ceoIds()),
      ],
      "ESCALATED",
      `Escalated: "${task.title}" passed its due date`,
      "A written explanation from the assignee is now mandatory.",
      task.id
    );
    escalated++;
  }

  // 4) Due-soon reminders (24h window, once)
  const dueSoon = await Task.findAll({
    where: {
      deleted: false,
      status: { [Op.notIn]: ["DONE", "CANCELLED", "ESCALATED"] },
      due_soon_sent: false,
      due_at: {
        [Op.gt]: t,
        [Op.lte]: t + 24 * 3600 * 1000,
      },
    },
  });

  for (const task of dueSoon) {
    await task.update({ due_soon_sent: true });
    await notify(
      [task.assignee_id],
      "DUE_SOON",
      `Due within 24h: "${task.title}"`,
      "",
      task.id
    );
  }

  return { breached, warned, escalated };
}

export default runSlaSweep;
