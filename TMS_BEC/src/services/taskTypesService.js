import { QueryTypes } from "sequelize";
import httpStatus from "http-status";
import sequelize from "../config/db.js";
import { TaskType, User } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { now } from "../lib/time.js";

function canManageTeamTypes(user, teamId) {
  if (user.role === "ADMIN" || user.role === "CEO") return true;
  return user.role === "MANAGER" && user.team_id === teamId;
}

export const listTaskTypes = async (user, { manage, teamId, userId }) => {
  if (manage) {
    let where = "1=1";
    const replacements = {};

    if (!["ADMIN", "CEO"].includes(user.role)) {
      if (user.role !== "MANAGER" || !user.team_id) {
        throw new ApiError(httpStatus.FORBIDDEN, "Only Heads/Admin manage task types");
      }
      where = "tt.team_id = :teamId";
      replacements.teamId = user.team_id;
    }

    const types = await sequelize.query(
      `SELECT tt.*, tm.name AS team_name,
        (SELECT COUNT(*)::int FROM tasks WHERE task_type_id = tt.id AND deleted = false) AS used_count
       FROM task_types tt JOIN teams tm ON tm.id = tt.team_id
       WHERE ${where} ORDER BY tm.name, tt.name`,
      { replacements, type: QueryTypes.SELECT }
    );
    return { types };
  }

  let resolvedTeamId = teamId ? Number(teamId) : null;
  if (!resolvedTeamId && userId) {
    const u = await User.findByPk(Number(userId), { attributes: ["team_id"] });
    resolvedTeamId = u?.team_id ?? null;
  }
  if (!resolvedTeamId) return { types: [] };

  const types = await sequelize.query(
    "SELECT id, team_id, name, description FROM task_types WHERE team_id = :teamId AND is_active = true ORDER BY name",
    { replacements: { teamId: resolvedTeamId }, type: QueryTypes.SELECT }
  );
  return { types };
};

export const createTaskType = async (user, { teamId, name, description = "" }) => {
  if (!teamId || !name?.trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "teamId and name are required");
  }
  if (!canManageTeamTypes(user, Number(teamId))) {
    throw new ApiError(httpStatus.FORBIDDEN, "You can only manage your own team's task types");
  }

  const trimmed = name.trim();
  const type = await TaskType.create({
    team_id: Number(teamId),
    name: trimmed,
    alias: trimmed,
    description,
    created_at: now(),
  });

  return { id: type.id };
};

export const updateTaskType = async (user, { id, name, isActive }) => {
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, "id required");

  const type = await TaskType.findByPk(Number(id));
  if (!type) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  if (!canManageTeamTypes(user, type.team_id)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
  }

  if (name !== undefined) {
    const trimmed = String(name).trim();
    await type.update({ name: trimmed, alias: trimmed });
  }
  if (isActive !== undefined) await type.update({ is_active: !!isActive });

  return { ok: true };
};

export const deleteTaskType = async (user, id) => {
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, "id required");

  const type = await TaskType.findByPk(Number(id));
  if (!type) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  if (!canManageTeamTypes(user, type.team_id)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
  }

  const [{ used_count: usedCount }] = await sequelize.query(
    "SELECT COUNT(*)::int AS used_count FROM tasks WHERE task_type_id = :id AND deleted = false",
    { replacements: { id: type.id }, type: QueryTypes.SELECT }
  );
  if (usedCount > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Used by ${usedCount} task${usedCount === 1 ? "" : "s"} — deactivate instead`
    );
  }

  await type.destroy();
  return { ok: true };
};

export default { listTaskTypes, createTaskType, updateTaskType, deleteTaskType };
