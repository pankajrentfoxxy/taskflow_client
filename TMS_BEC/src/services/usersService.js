import fs from "fs";
import bcrypt from "bcryptjs";
import { QueryTypes } from "sequelize";
import httpStatus from "http-status";
import sequelize from "../config/db.js";
import { User, Team } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { now } from "../lib/time.js";

const q = (sql, replacements, transaction) =>
  sequelize.query(sql, { replacements, transaction, type: QueryTypes.SELECT });

const exec = (sql, replacements, transaction) =>
  sequelize.query(sql, { replacements, transaction });

function removeFiles(paths) {
  for (const filePath of paths) {
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore missing or locked files
    }
  }
}

async function attachmentPathsForTasks(taskIds, transaction) {
  if (!taskIds.length) return [];
  const rows = await q(
    `SELECT file_path FROM attachments
     WHERE task_id IN (:taskIds)
        OR comment_id IN (SELECT id FROM comments WHERE task_id IN (:taskIds))`,
    { taskIds },
    transaction
  );
  return rows.map((r) => r.file_path).filter(Boolean);
}

async function hardDeleteTasks(taskIds, transaction) {
  if (!taskIds.length) return [];

  const expanded = await q(
    `WITH RECURSIVE task_tree AS (
       SELECT id FROM tasks WHERE id IN (:taskIds)
       UNION
       SELECT t.id FROM tasks t
       INNER JOIN task_tree tt ON t.parent_id = tt.id
     )
     SELECT id FROM task_tree`,
    { taskIds },
    transaction
  );
  const ids = [...new Set(expanded.map((r) => r.id))];
  if (!ids.length) return [];

  const filePaths = await attachmentPathsForTasks(ids, transaction);
  const rep = { ids };

  await exec(
    `DELETE FROM comment_reactions
     WHERE comment_id IN (SELECT id FROM comments WHERE task_id IN (:ids))`,
    rep,
    transaction
  );
  await exec(
    `DELETE FROM attachments
     WHERE task_id IN (:ids)
        OR comment_id IN (SELECT id FROM comments WHERE task_id IN (:ids))`,
    rep,
    transaction
  );
  await exec(`DELETE FROM comments WHERE task_id IN (:ids)`, rep, transaction);
  await exec(`DELETE FROM activity WHERE task_id IN (:ids)`, rep, transaction);
  await exec(`DELETE FROM escalations WHERE task_id IN (:ids)`, rep, transaction);
  await exec(`DELETE FROM notifications WHERE task_id IN (:ids)`, rep, transaction);
  await exec(`DELETE FROM tasks WHERE id IN (:ids)`, rep, transaction);

  return filePaths;
}

async function deleteOwnedProjects(userId, transaction) {
  const owned = await q(`SELECT id FROM projects WHERE owner_id = :userId`, { userId }, transaction);
  const projectIds = owned.map((p) => p.id);
  if (!projectIds.length) return [];

  const projectTasks = await q(`SELECT id FROM tasks WHERE project_id IN (:projectIds)`, { projectIds }, transaction);
  const taskFilePaths = await hardDeleteTasks(
    projectTasks.map((t) => t.id),
    transaction
  );

  const projectFiles = await q(
    `SELECT file_path FROM attachments WHERE project_id IN (:projectIds)`,
    { projectIds },
    transaction
  );

  await exec(`DELETE FROM attachments WHERE project_id IN (:projectIds)`, { projectIds }, transaction);
  await exec(`DELETE FROM project_notes WHERE project_id IN (:projectIds)`, { projectIds }, transaction);
  await exec(`DELETE FROM project_members WHERE project_id IN (:projectIds)`, { projectIds }, transaction);
  await exec(`DELETE FROM projects WHERE id IN (:projectIds)`, { projectIds }, transaction);

  return [...taskFilePaths, ...projectFiles.map((f) => f.file_path).filter(Boolean)];
}

async function deleteUserComments(userId, transaction) {
  const comments = await q(
    `WITH RECURSIVE comment_tree AS (
       SELECT id FROM comments WHERE author_id = :userId
       UNION
       SELECT c.id FROM comments c
       INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
     )
     SELECT id FROM comment_tree`,
    { userId },
    transaction
  );
  const commentIds = comments.map((c) => c.id);
  if (!commentIds.length) return [];

  const files = await q(
    `SELECT file_path FROM attachments WHERE comment_id IN (:commentIds)`,
    { commentIds },
    transaction
  );

  await exec(`DELETE FROM comment_reactions WHERE comment_id IN (:commentIds)`, { commentIds }, transaction);
  await exec(`DELETE FROM attachments WHERE comment_id IN (:commentIds)`, { commentIds }, transaction);
  await exec(`DELETE FROM comments WHERE id IN (:commentIds)`, { commentIds }, transaction);

  return files.map((f) => f.file_path).filter(Boolean);
}

async function purgeUserData(userId, transaction) {
  const filePaths = [];
  const t = now();

  filePaths.push(...(await deleteOwnedProjects(userId, transaction)));

  const creatorTasks = await q(
    `WITH RECURSIVE task_tree AS (
       SELECT id FROM tasks WHERE creator_id = :userId
       UNION
       SELECT t.id FROM tasks t
       INNER JOIN task_tree tt ON t.parent_id = tt.id
     )
     SELECT id FROM task_tree`,
    { userId },
    transaction
  );
  filePaths.push(...(await hardDeleteTasks(creatorTasks.map((r) => r.id), transaction)));

  filePaths.push(...(await deleteUserComments(userId, transaction)));

  const orphanUploads = await q(
    `SELECT file_path FROM attachments WHERE uploader_id = :userId`,
    { userId },
    transaction
  );
  await exec(`DELETE FROM attachments WHERE uploader_id = :userId`, { userId }, transaction);
  filePaths.push(...orphanUploads.map((f) => f.file_path).filter(Boolean));

  await exec(`DELETE FROM comment_reactions WHERE user_id = :userId`, { userId }, transaction);
  await exec(`DELETE FROM notifications WHERE user_id = :userId`, { userId }, transaction);
  await exec(`DELETE FROM project_members WHERE user_id = :userId`, { userId }, transaction);
  await exec(`DELETE FROM project_notes WHERE author_id = :userId`, { userId }, transaction);
  await exec(`DELETE FROM activity WHERE actor_id = :userId`, { userId }, transaction);
  await exec(`UPDATE escalations SET reviewer_id = NULL WHERE reviewer_id = :userId`, { userId }, transaction);
  await exec(
    `UPDATE tasks SET assignee_id = NULL, updated_at = :t WHERE assignee_id = :userId`,
    { userId, t },
    transaction
  );

  const boards = await q(`SELECT id FROM boards WHERE owner_id = :userId`, { userId }, transaction);
  const boardIds = boards.map((b) => b.id);
  if (boardIds.length) {
    await exec(`UPDATE tasks SET board_id = NULL, updated_at = :t WHERE board_id IN (:boardIds)`, { boardIds, t }, transaction);
    await exec(`DELETE FROM boards WHERE id IN (:boardIds)`, { boardIds }, transaction);
  }

  await exec(`UPDATE teams SET manager_id = NULL WHERE manager_id = :userId`, { userId }, transaction);

  return filePaths;
}

export const listUsers = async () => {
  const users = await sequelize.query(
    `SELECT u.id, u.name, u.email, u.role, u.team_id, u.is_active, tm.name AS team_name
     FROM users u LEFT JOIN teams tm ON tm.id = u.team_id
     ORDER BY u.name`,
    { type: QueryTypes.SELECT }
  );
  return { users };
};

export const createUser = async ({ name, email, password, role = "MEMBER", teamId = null }) => {
  if (!name || !email || !password) {
    throw new ApiError(httpStatus.BAD_REQUEST, "name, email, password required");
  }
  if (!["ADMIN", "CEO", "MANAGER", "MEMBER"].includes(role)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid role");
  }

  try {
    const user = await User.create({
      name,
      email: String(email).toLowerCase().trim(),
      password_hash: bcrypt.hashSync(password, 10),
      role,
      team_id: teamId,
      created_at: now(),
    });

    if (role === "MANAGER" && teamId) {
      await Team.update({ manager_id: user.id }, { where: { id: teamId } });
    }

    return { id: user.id };
  } catch (e) {
    const msg = e.message?.includes("unique") || e.name === "SequelizeUniqueConstraintError"
      ? "Email already exists"
      : "Could not create user";
    throw new ApiError(httpStatus.BAD_REQUEST, msg);
  }
};

export const updateUser = async ({ id, role, teamId, isActive, password }) => {
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, "id required");

  const user = await User.findByPk(id);
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "Not found");

  if (role !== undefined) await user.update({ role });
  if (teamId !== undefined) await user.update({ team_id: teamId });
  if (isActive !== undefined) await user.update({ is_active: !!isActive });
  if (password) await user.update({ password_hash: bcrypt.hashSync(password, 10) });

  return { ok: true };
};

export const deleteUser = async (actorId, id) => {
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, "id required");
  if (Number(id) === Number(actorId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You cannot delete your own account");
  }

  const user = await User.findByPk(Number(id));
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "Not found");

  if (user.role === "ADMIN") {
    const adminCount = await User.count({ where: { role: "ADMIN", is_active: true } });
    if (adminCount <= 1) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Cannot delete the last active admin");
    }
  }

  let filePaths = [];
  await sequelize.transaction(async (transaction) => {
    filePaths = await purgeUserData(user.id, transaction);
    await user.destroy({ transaction });
  });

  removeFiles([...new Set(filePaths)]);

  return { ok: true, deleted: true };
};

export default { listUsers, createUser, updateUser, deleteUser };
