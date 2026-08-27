import { QueryTypes } from "sequelize";
import httpStatus from "http-status";
import sequelize from "../config/db.js";
import { Team, User } from "../models/index.js";
import ApiError from "../utils/ApiError.js";

export const listTeams = async () => {
  const teams = await sequelize.query(
    `SELECT tm.id, tm.name, tm.manager_id, u.name AS manager_name,
      (SELECT COUNT(*)::int FROM users WHERE team_id = tm.id AND is_active = true) AS member_count
     FROM teams tm LEFT JOIN users u ON u.id = tm.manager_id ORDER BY tm.name`,
    { type: QueryTypes.SELECT }
  );
  return { teams };
};

export const createTeam = async ({ name, managerId = null }) => {
  if (!name) throw new ApiError(httpStatus.BAD_REQUEST, "name required");

  const team = await Team.create({ name, manager_id: managerId });

  if (managerId) {
    await sequelize.query(
      `UPDATE users SET team_id = :teamId,
       role = CASE WHEN role = 'MEMBER' THEN 'MANAGER' ELSE role END
       WHERE id = :managerId`,
      { replacements: { teamId: team.id, managerId } }
    );
  }

  return { id: team.id };
};

export const updateTeam = async ({ id, name, managerId, memberIds }) => {
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, "id required");

  const team = await Team.findByPk(Number(id));
  if (!team) throw new ApiError(httpStatus.NOT_FOUND, "Not found");

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new ApiError(httpStatus.BAD_REQUEST, "name required");
    try {
      await team.update({ name: trimmed });
    } catch (e) {
      if (e.name === "SequelizeUniqueConstraintError") {
        throw new ApiError(httpStatus.BAD_REQUEST, "A team with this name already exists");
      }
      throw e;
    }
  }

  if (memberIds !== undefined) {
    const ids = [...new Set(memberIds.map(Number).filter(Boolean))];
    if (ids.length > 0) {
      await sequelize.query(
        `UPDATE users SET team_id = NULL WHERE team_id = :teamId AND id NOT IN (:ids)`,
        { replacements: { teamId: team.id, ids } }
      );
      for (const uid of ids) {
        await User.update({ team_id: team.id }, { where: { id: uid } });
      }
    } else {
      await User.update({ team_id: null }, { where: { team_id: team.id } });
    }
  }

  if (managerId !== undefined) {
    const mid = managerId ? Number(managerId) : null;
    await team.update({ manager_id: mid });
    if (mid) {
      await sequelize.query(
        `UPDATE users SET team_id = :teamId,
         role = CASE WHEN role = 'MEMBER' THEN 'MANAGER' ELSE role END
         WHERE id = :mid`,
        { replacements: { teamId: team.id, mid } }
      );
    }
  }

  return { ok: true };
};

export const deleteTeam = async (id) => {
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, "id required");

  const team = await Team.findByPk(Number(id));
  if (!team) throw new ApiError(httpStatus.NOT_FOUND, "Not found");

  const [{ member_count: memberCount }] = await sequelize.query(
    "SELECT COUNT(*)::int AS member_count FROM users WHERE team_id = :id",
    { replacements: { id: team.id }, type: QueryTypes.SELECT }
  );
  if (memberCount > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Remove all members from this team first");
  }

  const [{ task_count: taskCount }] = await sequelize.query(
    "SELECT COUNT(*)::int AS task_count FROM tasks WHERE assigned_team_id = :id AND deleted = false",
    { replacements: { id: team.id }, type: QueryTypes.SELECT }
  );
  if (taskCount > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Team has assigned tasks — reassign them first");
  }

  const [{ type_count: typeCount }] = await sequelize.query(
    `SELECT COUNT(*)::int AS type_count FROM task_types tt
     WHERE tt.team_id = :id
       AND EXISTS (SELECT 1 FROM tasks t WHERE t.task_type_id = tt.id AND t.deleted = false)`,
    { replacements: { id: team.id }, type: QueryTypes.SELECT }
  );
  if (typeCount > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Team has task types in use — deactivate or delete them first");
  }

  await sequelize.query("DELETE FROM task_types WHERE team_id = :id", {
    replacements: { id: team.id },
  });
  await team.destroy();
  return { ok: true };
};

export default { listTeams, createTeam, updateTeam, deleteTeam };
