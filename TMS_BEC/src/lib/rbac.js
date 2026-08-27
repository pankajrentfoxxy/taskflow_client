import { QueryTypes } from "sequelize";
import sequelize from "../config/db.js";
import { User } from "../models/index.js";

/**
 * SQL fragment (aliased t) restricting tasks to what `user` may see, with bind params.
 * @param {{ id: number, role: string, team_id?: number|null }} user
 */
export function taskVisibilityWhere(user) {
  if (user.role === "ADMIN" || user.role === "CEO") {
    return { sql: "1=1", replacements: [] };
  }

  const base = `(t.assignee_id = :uid OR t.creator_id = :uid
    OR EXISTS (SELECT 1 FROM task_members tmv WHERE tmv.task_id = t.id AND tmv.user_id = :uid)
    OR t.project_id IN (SELECT project_id FROM project_members WHERE user_id = :uid)
    OR t.project_id IN (SELECT id FROM projects WHERE owner_id = :uid)
    ${user.team_id ? "OR t.assigned_team_id = :teamId" : ""})`;

  const replacements = { uid: user.id };
  if (user.team_id) replacements.teamId = user.team_id;

  if (user.role === "MANAGER" && user.team_id) {
    return {
      sql: `(${base} OR t.assignee_id IN (SELECT id FROM users WHERE team_id = :teamId2) OR t.assigned_team_id = :teamId3)`,
      replacements: {
        ...replacements,
        teamId2: user.team_id,
        teamId3: user.team_id,
      },
    };
  }

  return { sql: base, replacements };
}

export async function canSeeTask(user, task) {
  const { sql, replacements } = taskVisibilityWhere(user);
  const rows = await sequelize.query(
    `SELECT 1 FROM tasks t WHERE t.id = :taskId AND t.deleted = false AND ${sql}`,
    {
      replacements: { ...replacements, taskId: task.id },
      type: QueryTypes.SELECT,
    }
  );
  return rows.length > 0;
}

export async function isManagerOf(user, otherUserId) {
  if (user.role !== "MANAGER" || !user.team_id || !otherUserId) return false;
  const member = await User.findOne({
    where: { id: otherUserId, team_id: user.team_id },
    attributes: ["id"],
  });
  return !!member;
}

/** @param {{ user_id: number, role: string }[]} members */
export function isTaskCollaborator(members, userId) {
  return members.some((m) => m.user_id === userId && m.role === "COLLABORATOR");
}

/** @param {{ user_id: number, role: string }[]} members */
export function isTaskWatcher(members, userId) {
  return members.some((m) => m.user_id === userId && m.role === "WATCHER");
}

/** Collaborators may perform the same task actions as the primary assignee. */
export function canActAsTaskAssignee(user, task, members = []) {
  if (task.assignee_id === user.id) return true;
  return isTaskCollaborator(members, user.id);
}

/** ETA editable by: assignee, collaborator, assignee's manager, CEO, Admin. */
export async function canEditEta(user, task, members = []) {
  if (user.role === "ADMIN" || user.role === "CEO") return true;
  if (task.assignee_id === user.id) return true;
  if (isTaskCollaborator(members, user.id)) return true;
  return isManagerOf(user, task.assignee_id);
}

export async function canReviewEscalation(user, task) {
  if (user.role === "ADMIN" || user.role === "CEO") return true;
  return isManagerOf(user, task.assignee_id);
}

/** Reassign assignee: creator, Admin/CEO, or assignee's manager. Not on closed tasks. */
export async function canReassignTask(user, task) {
  if (["DONE", "CANCELLED", "REJECTED"].includes(task.status)) return false;
  if (user.role === "ADMIN" || user.role === "CEO") return true;
  if (task.creator_id === user.id) return true;
  return isManagerOf(user, task.assignee_id);
}

export function canProvideTaskInput(user, task) {
  if (task.status !== "WAITING_FOR_INPUT") return false;
  if (user.role === "ADMIN" || user.role === "CEO") return true;
  return task.creator_id === user.id;
}

export function canViewTaskInputRequest(user, task, members = []) {
  if (!task.input_request_note) return false;
  if (user.role === "ADMIN" || user.role === "CEO") return true;
  if (task.creator_id === user.id) return true;
  if (task.assignee_id === user.id) return true;
  if (isTaskCollaborator(members, user.id)) return true;
  return false;
}

export function canViewTaskInputPayload(user, task, members = []) {
  if (!task.input_payload) return false;
  if (user.role === "ADMIN" || user.role === "CEO") return true;
  if (task.creator_id === user.id) return true;
  if (task.assignee_id === user.id) return true;
  if (isTaskCollaborator(members, user.id)) return true;
  return false;
}

/** Add/remove collaborators & watchers. Primary assignee and collaborators may manage members. */
export function canManageTaskMembers(user, task, members = []) {
  if (["DONE", "CANCELLED", "REJECTED"].includes(task.status)) return false;
  if (user.role === "ADMIN" || user.role === "CEO") return true;
  if (task.creator_id === user.id) return true;
  if (task.assignee_id === user.id) return true;
  if (isTaskCollaborator(members, user.id)) return true;
  return false;
}

export function canManageProject(user, project) {
  return user.role === "ADMIN" || project.owner_id === user.id;
}

export async function isProjectMember(user, projectId) {
  if (user.role === "ADMIN" || user.role === "CEO") return true;
  const rows = await sequelize.query(
    `SELECT 1 FROM project_members WHERE project_id = :projectId AND user_id = :userId
     UNION
     SELECT 1 FROM projects WHERE id = :projectId2 AND owner_id = :userId2`,
    {
      replacements: {
        projectId,
        userId: user.id,
        projectId2: projectId,
        userId2: user.id,
      },
      type: QueryTypes.SELECT,
    }
  );
  return rows.length > 0;
}

export default {
  taskVisibilityWhere,
  canSeeTask,
  isManagerOf,
  isTaskCollaborator,
  isTaskWatcher,
  canActAsTaskAssignee,
  canEditEta,
  canReviewEscalation,
  canReassignTask,
  canProvideTaskInput,
  canViewTaskInputRequest,
  canViewTaskInputPayload,
  canManageTaskMembers,
  canManageProject,
  isProjectMember,
};
