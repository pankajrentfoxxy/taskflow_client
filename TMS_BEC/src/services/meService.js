import { QueryTypes } from "sequelize";
import sequelize from "../config/db.js";
import { runSlaSweep } from "../lib/cron.js";

export const getMe = async (user) => {
  await runSlaSweep();

  const [unreadRow] = await sequelize.query(
    "SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = :userId AND is_visible = true AND read_at IS NULL",
    { replacements: { userId: user.id }, type: QueryTypes.SELECT }
  );

  let team = null;
  if (user.team_id) {
    const [teamRow] = await sequelize.query(
      "SELECT name FROM teams WHERE id = :teamId",
      { replacements: { teamId: user.team_id }, type: QueryTypes.SELECT }
    );
    team = teamRow?.name ?? null;
  }

  return {
    user: { ...user, team },
    unread: unreadRow?.c ?? 0,
  };
};

export default { getMe };
