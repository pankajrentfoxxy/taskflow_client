import { QueryTypes } from "sequelize";
import httpStatus from "http-status";
import sequelize from "../config/db.js";
import { Project, ProjectMember, ProjectNote } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { isProjectMember, canManageProject } from "../lib/rbac.js";
import { notify } from "../lib/notify.js";
import { now } from "../lib/time.js";

export const listProjects = async (user) => {
  const isBoss = ["ADMIN", "CEO"].includes(user.role);
  const where = isBoss
    ? "1=1"
    : "(p.owner_id = :uid OR p.id IN (SELECT project_id FROM project_members WHERE user_id = :uid2))";
  const replacements = isBoss ? {} : { uid: user.id, uid2: user.id };

  const projects = await sequelize.query(
    `SELECT p.*, u.name AS owner_name,
      (SELECT COUNT(*)::int FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
      (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id AND t.status NOT IN ('DONE','CANCELLED') AND t.deleted = false) AS open_tasks
     FROM projects p JOIN users u ON u.id = p.owner_id
     WHERE ${where} ORDER BY p.created_at DESC`,
    { replacements, type: QueryTypes.SELECT }
  );
  return { projects };
};

export const createProject = async (user, { name, description = "" }) => {
  if (!name?.trim()) throw new ApiError(httpStatus.BAD_REQUEST, "Project name required");

  const t = now();
  const project = await Project.create({
    name: name.trim(),
    description,
    owner_id: user.id,
    created_at: t,
  });
  await ProjectMember.create({ project_id: project.id, user_id: user.id });

  return { id: project.id };
};

export const getProject = async (user, projectId) => {
  const [project] = await sequelize.query(
    "SELECT p.*, u.name AS owner_name FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = :pid",
    { replacements: { pid: projectId }, type: QueryTypes.SELECT }
  );
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, "Not found");

  const member = await isProjectMember(user, projectId);
  if (!member) throw new ApiError(httpStatus.FORBIDDEN, "You are not a member of this project");

  const members = await sequelize.query(
    `SELECT u.id, u.name, u.email, u.role FROM project_members pm JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = :pid ORDER BY u.name`,
    { replacements: { pid: projectId }, type: QueryTypes.SELECT }
  );

  const notes = await sequelize.query(
    `SELECT n.*, u.name AS author_name FROM project_notes n JOIN users u ON u.id = n.author_id
     WHERE n.project_id = :pid ORDER BY n.pinned DESC, n.id DESC`,
    { replacements: { pid: projectId }, type: QueryTypes.SELECT }
  );

  const tasks = await sequelize.query(
    `SELECT t.*, ua.name AS assignee_name, uc.name AS creator_name, tm.name AS team_name,
      tt.name AS type_name,
      (SELECT COUNT(*)::int FROM tasks s WHERE s.parent_id = t.id AND s.deleted = false) AS subtask_count,
      (SELECT COUNT(*)::int FROM tasks s WHERE s.parent_id = t.id AND s.status = 'DONE' AND s.deleted = false) AS subtask_done,
      (SELECT COUNT(*)::int FROM comments c WHERE c.task_id = t.id) AS comment_count
     FROM tasks t
     LEFT JOIN task_types tt ON tt.id = t.task_type_id
     LEFT JOIN users ua ON ua.id = t.assignee_id
     LEFT JOIN users uc ON uc.id = t.creator_id
     LEFT JOIN teams tm ON tm.id = t.assigned_team_id
     WHERE t.project_id = :pid AND t.parent_id IS NULL AND t.deleted = false
     ORDER BY CASE t.status WHEN 'ESCALATED' THEN 0 WHEN 'ASSIGNED' THEN 1 ELSE 2 END, t.due_at`,
    { replacements: { pid: projectId }, type: QueryTypes.SELECT }
  );

  const files = await sequelize.query(
    `SELECT a.id, a.file_name, a.mime_type, a.size, a.created_at, u.name AS uploader_name, a.task_id
     FROM attachments a JOIN users u ON u.id = a.uploader_id
     WHERE a.project_id = :pid OR a.task_id IN (SELECT id FROM tasks WHERE project_id = :pid2 AND deleted = false)
     ORDER BY a.id DESC`,
    { replacements: { pid: projectId, pid2: projectId }, type: QueryTypes.SELECT }
  );

  const activity = await sequelize.query(
    `SELECT a.*, u.name AS actor_name, t.title AS task_title
     FROM activity a LEFT JOIN users u ON u.id = a.actor_id LEFT JOIN tasks t ON t.id = a.task_id
     WHERE a.task_id IN (SELECT id FROM tasks WHERE project_id = :pid AND deleted = false)
     ORDER BY a.id DESC LIMIT 100`,
    { replacements: { pid: projectId }, type: QueryTypes.SELECT }
  );

  return {
    project,
    members,
    notes,
    tasks,
    files,
    activity,
    canManage: canManageProject(user, project),
  };
};

export const updateProject = async (user, projectId, body) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, "Not found");

  const member = await isProjectMember(user, projectId);
  if (!member) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const t = now();

  if (body.addMemberId !== undefined) {
    if (!canManageProject(user, project)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Only the owner/Admin manages members");
    }
    await ProjectMember.findOrCreate({
      where: { project_id: projectId, user_id: Number(body.addMemberId) },
      defaults: { project_id: projectId, user_id: Number(body.addMemberId) },
    });
    await notify(
      [Number(body.addMemberId)],
      "PROJECT",
      `You were added to project "${project.name}"`,
      "",
      null,
      user.id
    );
  }

  if (body.removeMemberId !== undefined) {
    if (!canManageProject(user, project)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Only the owner/Admin manages members");
    }
    await ProjectMember.destroy({
      where: { project_id: projectId, user_id: Number(body.removeMemberId) },
    });
  }

  if (body.note) {
    await ProjectNote.create({
      project_id: projectId,
      author_id: user.id,
      body: String(body.note).trim(),
      created_at: t,
    });
  }

  if (body.togglePinNoteId !== undefined) {
    if (!canManageProject(user, project)) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
    await sequelize.query(
      "UPDATE project_notes SET pinned = NOT pinned WHERE id = :noteId AND project_id = :pid",
      { replacements: { noteId: Number(body.togglePinNoteId), pid: projectId } }
    );
  }

  if (body.description !== undefined) {
    if (!canManageProject(user, project)) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
    await project.update({ description: String(body.description) });
  }

  return { ok: true };
};

export default { listProjects, createProject, getProject, updateProject };
