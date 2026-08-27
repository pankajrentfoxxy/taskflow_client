import { User, Team, Notification, Activity } from "../models/index.js";
import { now } from "./time.js";

export async function notify(
  userIds,
  type,
  title,
  body = "",
  taskId = null,
  excludeUserId = null
) {
  const seen = new Set();
  const rows = [];
  const ts = now();

  for (const id of userIds) {
    if (!id || id === excludeUserId || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      user_id: id,
      type,
      title,
      body,
      task_id: taskId,
      created_at: ts,
    });
  }

  if (rows.length > 0) {
    const created = await Notification.bulkCreate(rows);
    try {
      const { emitNotificationsFromRows } = await import("./socket.js");
      emitNotificationsFromRows(created);
    } catch {
      // socket optional during tests
    }
  }
}

/** assignee's manager's user id (via team), or null */
export async function managerOf(assigneeId) {
  if (!assigneeId) return null;
  const user = await User.findByPk(assigneeId, {
    attributes: ["id", "team_id"],
    include: [{ model: Team, as: "team", attributes: ["manager_id"] }],
  });
  return user?.team?.manager_id ?? null;
}

export async function ceoIds() {
  const ceos = await User.findAll({
    where: { role: "CEO", is_active: true },
    attributes: ["id"],
  });
  return ceos.map((u) => u.id);
}

export async function logActivity(taskId, actorId, type, meta = {}) {
  await Activity.create({
    task_id: taskId,
    actor_id: actorId,
    type,
    meta: JSON.stringify(meta),
    created_at: now(),
  });
}

export default { notify, managerOf, ceoIds, logActivity };
