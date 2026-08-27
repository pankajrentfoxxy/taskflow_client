import { QueryTypes } from "sequelize";
import sequelize from "../config/db.js";
import { now } from "../lib/time.js";

const visibleClause = "user_id = :userId AND is_visible = true";

export const listNotifications = async (user) => {
  const notifications = await sequelize.query(
    `SELECT * FROM notifications WHERE ${visibleClause} ORDER BY id DESC LIMIT 50`,
    { replacements: { userId: user.id }, type: QueryTypes.SELECT }
  );

  const [unreadRow] = await sequelize.query(
    `SELECT COUNT(*)::int AS c FROM notifications WHERE ${visibleClause} AND read_at IS NULL`,
    { replacements: { userId: user.id }, type: QueryTypes.SELECT }
  );

  return { notifications, unread: unreadRow?.c ?? 0 };
};

export const markNotificationsRead = async (user, { ids, all }) => {
  const t = now();

  if (all) {
    await sequelize.query(
      `UPDATE notifications SET read_at = :t WHERE ${visibleClause} AND read_at IS NULL`,
      { replacements: { t, userId: user.id } }
    );
  } else if (Array.isArray(ids)) {
    for (const id of ids) {
      await sequelize.query(
        "UPDATE notifications SET read_at = :t WHERE id = :id AND user_id = :userId AND is_visible = true",
        { replacements: { t, id, userId: user.id } }
      );
    }
  }

  return { ok: true };
};

export const clearNotifications = async (user) => {
  const t = now();
  await sequelize.query(
    `UPDATE notifications SET is_visible = false, read_at = COALESCE(read_at, :t) WHERE ${visibleClause}`,
    { replacements: { t, userId: user.id } }
  );
  return { ok: true };
};

export default { listNotifications, markNotificationsRead, clearNotifications };
