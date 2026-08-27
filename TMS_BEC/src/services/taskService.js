import { randomUUID } from "crypto";
import { QueryTypes } from "sequelize";
import httpStatus from "http-status";
import sequelize from "../config/db.js";
import {
  Task,
  User,
  TaskType,
  Attachment,
  Comment,
  CommentReaction,
  Escalation,
} from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import {
  taskVisibilityWhere,
  canSeeTask,
  canEditEta,
  canReviewEscalation,
  canReassignTask,
  canProvideTaskInput,
  canViewTaskInputRequest,
  canViewTaskInputPayload,
  canManageTaskMembers,
  isTaskCollaborator,
  isTaskWatcher,
  canActAsTaskAssignee,
  isManagerOf,
} from "../lib/rbac.js";
import { addWorkingMinutes } from "../lib/sla.js";
import { notify, managerOf, ceoIds, logActivity } from "../lib/notify.js";
import { sendTaskCreatedEmails } from "./taskMailService.js";
import { runSlaSweep } from "../lib/cron.js";
import { now } from "../lib/time.js";

const SUB_COUNTS = `
  (SELECT COUNT(*)::int FROM tasks s WHERE s.parent_id = t.id AND s.deleted = false) AS subtask_count,
  (SELECT COUNT(*)::int FROM tasks s WHERE s.parent_id = t.id AND s.status = 'DONE' AND s.deleted = false) AS subtask_done,
  (SELECT COUNT(*)::int FROM comments c WHERE c.task_id = t.id) AS comment_count`;

const ESCALATION_REVIEW_PENDING = `
  COALESCE((
    SELECT (e.explanation IS NOT NULL AND e.review_status = 'PENDING')
    FROM escalations e
    WHERE e.task_id = t.id
    ORDER BY e.id DESC
    LIMIT 1
  ), false) AS escalation_review_pending`;

const MEMBER_COUNT = `(SELECT COUNT(*)::int FROM task_members tm WHERE tm.task_id = t.id) AS member_count`;

const VALID_MEMBER_ROLES = new Set(["COLLABORATOR", "WATCHER"]);

async function loadTaskMembers(taskId) {
  return sequelize.query(
    `SELECT tm.task_id, tm.user_id, tm.role, tm.added_by, tm.created_at,
            u.name AS user_name, u.email AS user_email
     FROM task_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.task_id = :taskId
     ORDER BY CASE tm.role WHEN 'COLLABORATOR' THEN 0 ELSE 1 END, u.name`,
    { replacements: { taskId }, type: QueryTypes.SELECT }
  );
}

function buildMemberEntries(body, assigneeId) {
  const primary = assigneeId ? Number(assigneeId) : null;
  const collaboratorIds = [...new Set((body.collaboratorIds || []).map(Number).filter(Boolean))];
  const watcherIds = [...new Set((body.watcherIds || []).map(Number).filter(Boolean))];
  const members = [];

  for (const userId of collaboratorIds) {
    if (primary && userId === primary) continue;
    members.push({ userId, role: "COLLABORATOR" });
  }
  for (const userId of watcherIds) {
    if (primary && userId === primary) continue;
    if (members.some((m) => m.userId === userId)) continue;
    members.push({ userId, role: "WATCHER" });
  }
  return members;
}

async function insertTaskMembers(taskId, members, addedBy, createdAt) {
  if (!members.length) return;
  for (const { userId, role } of members) {
    const user = await User.findOne({ where: { id: userId, is_active: true }, attributes: ["id"] });
    if (!user) continue;
    await sequelize.query(
      `INSERT INTO task_members (task_id, user_id, role, added_by, created_at)
       VALUES (:taskId, :userId, :role, :addedBy, :createdAt)
       ON CONFLICT (task_id, user_id) DO NOTHING`,
      {
        replacements: { taskId, userId, role, addedBy, createdAt },
      }
    );
  }
}

export async function loadTask(id, { includeDeleted = false } = {}) {
  const deletedClause = includeDeleted ? "" : " AND t.deleted = false";
  const [task] = await sequelize.query(
    `SELECT t.*, ua.name AS assignee_name, uc.name AS creator_name, tm.name AS team_name, p.name AS project_name,
      tt.name AS type_name
     FROM tasks t
     LEFT JOIN task_types tt ON tt.id = t.task_type_id
     LEFT JOIN users ua ON ua.id = t.assignee_id
     LEFT JOIN users uc ON uc.id = t.creator_id
     LEFT JOIN teams tm ON tm.id = t.assigned_team_id
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.id = :id${deletedClause}`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  return task ?? null;
}

async function explanationPending(task) {
  if (task.status !== "ESCALATED") return false;
  const [esc] = await sequelize.query(
    "SELECT * FROM escalations WHERE task_id = :taskId ORDER BY id DESC LIMIT 1",
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );
  return esc && !esc.explanation;
}

export const listTasks = async (
  user,
  { filter = "mine", status, q, projectId, assigneeId, teamId, page = 1, limit = 25, dueFrom, dueTo }
) => {
  await runSlaSweep();

  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const offset = (page - 1) * limit;
  const emptyPage = { tasks: [], pagination: { page, limit, total: 0, totalPages: 1 } };

  const { sql, replacements } = taskVisibilityWhere(user);
  let where = `(${sql})`;
  const repl = { ...replacements, limit, offset };

  if (assigneeId || teamId) {
    if (!["ADMIN", "CEO"].includes(user.role)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Admin or CEO only");
    }
    if (assigneeId) {
      where += ` AND (t.assignee_id = :filterAssigneeId OR (
        t.assignee_id IS NULL AND t.assigned_team_id = (SELECT team_id FROM users WHERE id = :filterAssigneeId2 LIMIT 1)
      ))`;
      repl.filterAssigneeId = Number(assigneeId);
      repl.filterAssigneeId2 = Number(assigneeId);
    }
    if (teamId) {
      where += " AND (t.assignee_id IN (SELECT id FROM users WHERE team_id = :filterTeamId) OR t.assigned_team_id = :filterTeamId2)";
      repl.filterTeamId = Number(teamId);
      repl.filterTeamId2 = Number(teamId);
    }
  }

  if (filter === "mine") {
    where += ` AND (t.assignee_id = :mineUid OR EXISTS (
      SELECT 1 FROM task_members tmine WHERE tmine.task_id = t.id AND tmine.user_id = :mineMemberUid`;
    repl.mineUid = user.id;
    repl.mineMemberUid = user.id;
    if (user.team_id) {
      where += ") OR t.assigned_team_id = :mineTeamId)";
      repl.mineTeamId = user.team_id;
    } else {
      where += "))";
    }
  } else if (filter === "created") {
    where += " AND t.creator_id = :creatorId";
    repl.creatorId = user.id;
  } else if (filter === "team") {
    if (user.role === "MANAGER" && user.team_id) {
      where += " AND (t.assignee_id IN (SELECT id FROM users WHERE team_id = :mgrTeamId) OR t.assigned_team_id = :mgrTeamId2)";
      repl.mgrTeamId = user.team_id;
      repl.mgrTeamId2 = user.team_id;
    } else if (!["ADMIN", "CEO"].includes(user.role)) {
      return emptyPage;
    }
  }

  if (status === "all") {
    // no status filter — include every status
  } else if (status) {
    where += " AND t.status = :status";
    repl.status = status;
  } else {
    where += " AND t.status != 'DONE'";
  }
  if (q) {
    where += " AND (t.title ILIKE :q OR t.description ILIKE :q)";
    repl.q = `%${q}%`;
  }
  if (dueFrom != null && dueFrom !== "") {
    where += " AND t.due_at >= :dueFrom";
    repl.dueFrom = Number(dueFrom);
  }
  if (dueTo != null && dueTo !== "") {
    where += " AND t.due_at <= :dueTo";
    repl.dueTo = Number(dueTo);
  }
  if (projectId) {
    where += " AND t.project_id = :projectId";
    repl.projectId = Number(projectId);
  } else {
    where += " AND t.parent_id IS NULL";
  }
  where += " AND t.deleted = false";

  const fromClause = `
     FROM tasks t
     LEFT JOIN task_types tt ON tt.id = t.task_type_id
     LEFT JOIN users ua ON ua.id = t.assignee_id
     LEFT JOIN users uc ON uc.id = t.creator_id
     LEFT JOIN teams tm ON tm.id = t.assigned_team_id
     LEFT JOIN projects p ON p.id = t.project_id`;

  const [countRow] = await sequelize.query(`SELECT COUNT(*)::int AS total ${fromClause} WHERE ${where}`, {
    replacements: repl,
    type: QueryTypes.SELECT,
  });
  const total = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

  const tasks = await sequelize.query(
    `SELECT t.*, ${SUB_COUNTS}, ${ESCALATION_REVIEW_PENDING}, ${MEMBER_COUNT},
      ua.name AS assignee_name, uc.name AS creator_name, tm.name AS team_name, p.name AS project_name,
      tt.name AS type_name
     ${fromClause}
     WHERE ${where}
     ORDER BY CASE t.status WHEN 'ESCALATED' THEN 0 WHEN 'WAITING_FOR_INPUT' THEN 1 WHEN 'ASSIGNED' THEN 2 WHEN 'DISCUSS' THEN 3 WHEN 'INPUT_PROVIDED' THEN 4 ELSE 5 END, t.due_at ASC
     LIMIT :limit OFFSET :offset`,
    { replacements: repl, type: QueryTypes.SELECT }
  );

  return { tasks, pagination: { page, limit, total, totalPages } };
};

export const createTask = async (user, body) => {
  const {
    title,
    description = "",
    assigneeId = null,
    teamId = null,
    priority = "NORMAL",
    dueAt,
    projectId = null,
    parentId = null,
    multiple = false,
    lines = [],
    attachmentIds = [],
    descriptionAttachmentIds = [],
    boardId = null,
    taskTypeId = null,
    collaboratorIds = [],
    watcherIds = [],
  } = body;

  if (!dueAt) throw new ApiError(httpStatus.BAD_REQUEST, "Due date is required");
  if (!assigneeId && !teamId) throw new ApiError(httpStatus.BAD_REQUEST, "Choose an assignee (person or team)");
  if (assigneeId && teamId) throw new ApiError(httpStatus.BAD_REQUEST, "Assign to a person OR a team, not both");

  const t = now();
  let effProject = projectId ? Number(projectId) : null;
  let parent = null;

  if (parentId) {
    parent = await Task.findByPk(parentId);
    if (!parent || parent.deleted) throw new ApiError(httpStatus.BAD_REQUEST, "Parent task not found");
    if (parent.parent_id) throw new ApiError(httpStatus.BAD_REQUEST, "Subtasks cannot have their own subtasks");
    effProject = parent.project_id;
  }

  let effType = null;
  if (taskTypeId) {
    const type = await TaskType.findOne({
      where: { id: Number(taskTypeId), is_active: true },
    });
    if (!type) throw new ApiError(httpStatus.BAD_REQUEST, "Task type not found or inactive");

    let targetTeam;
    if (teamId) {
      targetTeam = Number(teamId);
    } else {
      const assignee = await User.findByPk(Number(assigneeId), { attributes: ["team_id"] });
      targetTeam = assignee?.team_id;
    }
    if (type.team_id !== targetTeam) {
      throw new ApiError(httpStatus.BAD_REQUEST, "This task type belongs to a different team than the assignee");
    }
    effType = type.id;
  }

  const titles = multiple
    ? lines.map((l) => l.trim()).filter(Boolean)
    : [String(title || "").trim()];
  if (titles.length === 0 || !titles[0]) throw new ApiError(httpStatus.BAD_REQUEST, "Title is required");

  const batchId = titles.length > 1 ? randomUUID() : null;
  const sla = addWorkingMinutes(t, 30);
  const created = [];
  const memberEntries = buildMemberEntries({ collaboratorIds, watcherIds }, assigneeId);

  for (const tt of titles) {
    const task = await Task.create({
      title: tt,
      description,
      priority,
      creator_id: user.id,
      assignee_id: assigneeId,
      assigned_team_id: teamId,
      project_id: effProject,
      parent_id: parentId,
      batch_id: batchId,
      board_id: boardId,
      task_type_id: effType,
      target_count: null,
      due_at: dueAt,
      sla_deadline_at: sla,
      created_at: t,
      updated_at: t,
    });
    created.push(task.id);
    await logActivity(task.id, user.id, "CREATED", batchId ? { batchId } : {});
    await insertTaskMembers(task.id, memberEntries, user.id, t);
  }

  if (attachmentIds.length && created.length) {
    for (const aid of attachmentIds) {
      await Attachment.update(
        { task_id: created[0], context: "file" },
        { where: { id: aid, uploader_id: user.id } }
      );
    }
  }

  const descIds = Array.isArray(descriptionAttachmentIds)
    ? descriptionAttachmentIds.map(Number).filter(Boolean)
    : [];
  if (descIds.length && created.length) {
    const { linkAttachmentsToTask } = await import("./uploadsService.js");
    await linkAttachmentsToTask(created[0], descIds, user.id, "description");
  }

  const label = titles.length > 1 ? `${titles.length} new tasks` : `New task: "${titles[0]}"`;
  if (assigneeId) {
    await notify(
      [Number(assigneeId)],
      "ASSIGNED",
      label,
      `Assigned by ${user.name}. Accept within 30 working minutes.`,
      created[0],
      user.id
    );
  } else if (teamId) {
    const members = await User.findAll({
      where: { team_id: teamId, is_active: true },
      attributes: ["id"],
    });
    const [teamRow] = await sequelize.query(
      "SELECT manager_id FROM teams WHERE id = :teamId",
      { replacements: { teamId }, type: QueryTypes.SELECT }
    );
    const ids = [...members.map((m) => m.id), teamRow?.manager_id].filter(Boolean);
    await notify(ids, "ASSIGNED", `${label} (team task)`, `Assigned by ${user.name} to your team.`, created[0], user.id);
  }

  if (memberEntries.length && created.length) {
    const memberIds = memberEntries.map((m) => m.userId);
    await notify(
      memberIds,
      "TASK_MEMBER",
      `Added to task: "${titles[0]}"`,
      `Added by ${user.name} as a collaborator or watcher.`,
      created[0],
      user.id
    );
  }

  if (parent?.assignee_id) {
    await notify(
      [parent.assignee_id, parent.creator_id],
      "SUBTASK",
      `Subtask added on "${parent.title}"`,
      titles[0],
      parent.id,
      user.id
    );
  }

  sendTaskCreatedEmails({
    taskId: created[0],
    titles,
    dueAt,
    creatorName: user.name,
    creatorId: user.id,
    assigneeId,
    teamId,
    memberEntries,
  });

  try {
    const { emitTasksCreated } = await import("../lib/socket.js");
    const primaryTask = created.length ? await loadTask(created[0]) : null;
    await emitTasksCreated({ taskIds: created, actor: user, primaryTask });
  } catch {
    // socket optional
  }

  return { ids: created };
};

export const getTaskDetail = async (user, taskId) => {
  const task = await loadTask(taskId);
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const isBoss = ["ADMIN", "CEO"].includes(user.role);

  const subtasks = await sequelize.query(
    `SELECT t.*, ua.name AS assignee_name, tm.name AS team_name, tt.name AS type_name,
      (SELECT COUNT(*)::int FROM comments c WHERE c.task_id = t.id) AS comment_count,
      ${ESCALATION_REVIEW_PENDING}
     FROM tasks t
     LEFT JOIN users ua ON ua.id = t.assignee_id
     LEFT JOIN teams tm ON tm.id = t.assigned_team_id
     LEFT JOIN task_types tt ON tt.id = t.task_type_id
     WHERE t.parent_id = :taskId AND t.deleted = false ORDER BY t.id`,
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );

  const comments = await sequelize.query(
    `SELECT c.id, c.task_id, c.author_id, c.parent_comment_id, c.body AS content,
            c.edited, c.edited_at, c.created_at, c.updated_at,
            u.name AS author_name
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.task_id = :taskId ORDER BY c.created_at ASC, c.id ASC`,
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );

  const activity = isBoss
    ? await sequelize.query(
        `SELECT a.*, u.name AS actor_name FROM activity a LEFT JOIN users u ON u.id = a.actor_id
         WHERE a.task_id = :taskId ORDER BY a.id DESC LIMIT 100`,
        { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
      )
    : [];

  const attachments = await sequelize.query(
    "SELECT id, file_name, mime_type, size, uploader_id, context, created_at FROM attachments WHERE task_id = :taskId ORDER BY created_at ASC, id ASC",
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );

  const [escalation] = await sequelize.query(
    "SELECT * FROM escalations WHERE task_id = :taskId ORDER BY id DESC LIMIT 1",
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );

  const batchTasks = task.batch_id
    ? await sequelize.query(
        "SELECT id, title, status FROM tasks WHERE batch_id = :batchId AND id != :taskId AND deleted = false",
        { replacements: { batchId: task.batch_id, taskId: task.id }, type: QueryTypes.SELECT }
      )
    : [];

  const members = await loadTaskMembers(task.id);
  const isTaskMember = members.some((m) => m.user_id === user.id);
  const isCollaborator = isTaskCollaborator(members, user.id);
  const isWatcher = isTaskWatcher(members, user.id);

  const isAssignee = task.assignee_id === user.id;
  const isCreator = task.creator_id === user.id;
  const isMgr = await isManagerOf(user, task.assignee_id);
  const canActAsAssignee = canActAsTaskAssignee(user, task, members);
  const expPending = await explanationPending(task);
  const openSubs = subtasks.filter((s) => !["DONE", "CANCELLED", "REJECTED"].includes(s.status)).length;
  const claimable = task.assigned_team_id && task.assigned_team_id === user.team_id;
  const canRespond = canActAsAssignee || claimable || isBoss;
  const awaitingAccept = ["ASSIGNED", "DISCUSS"].includes(task.status);
  const isEscalated = task.status === "ESCALATED";

  const permissions = {
    isAssignee,
    isCollaborator,
    isWatcher,
    canActAsAssignee,
    isTaskMember,
    canManageMembers: canManageTaskMembers(user, task, members),
    canComment: !isWatcher,
    canEditDetails:
      isCreator && !["DONE", "CANCELLED", "REJECTED"].includes(task.status),
    canAcknowledge: awaitingAccept && canRespond && !expPending,
    canDiscuss: task.status === "ASSIGNED" && canRespond && !expPending,
    canReject:
      (awaitingAccept && canRespond && !expPending) || (isEscalated && isBoss),
    canStart:
      (isEscalated && isBoss) ||
      (task.status === "ACKNOWLEDGED" && canActAsAssignee && !expPending),
    canDone:
      (isEscalated && isBoss) ||
      (!isEscalated &&
        ["ACKNOWLEDGED", "IN_PROGRESS"].includes(task.status) &&
        (canActAsAssignee || isBoss || isCreator) &&
        !expPending),
    canRequestInput:
      canActAsAssignee &&
      ["ACKNOWLEDGED", "IN_PROGRESS"].includes(task.status) &&
      !expPending,
    canProvideInput: canProvideTaskInput(user, task),
    canResumeAfterInput: canActAsAssignee && task.status === "INPUT_PROVIDED" && !expPending,
    canViewInputRequest: canViewTaskInputRequest(user, task, members),
    canViewInputPayload: canViewTaskInputPayload(user, task, members),
    canEditEta: isEscalated
      ? isBoss
      : task.status === "ASSIGNED"
        ? isBoss
        : (await canEditEta(user, task, members)) &&
          !["DONE", "CANCELLED", "REJECTED"].includes(task.status) &&
          !expPending,
    canReopen:
      task.status === "DONE" &&
      (isCreator || isBoss || isMgr) &&
      now() - (task.done_at || 0) < 7 * 24 * 3600 * 1000,
    canCancel:
      !["DONE", "CANCELLED", "REJECTED"].includes(task.status) &&
      ((isEscalated && isBoss) || (!isEscalated && (isCreator || isBoss))),
    canBlock: ["ACKNOWLEDGED", "IN_PROGRESS"].includes(task.status) && canActAsAssignee,
    canUnblock: Boolean(task.blocked_reason) && (canActAsAssignee || isBoss),
    mustExplain: expPending && canActAsAssignee,
    canReview:
      task.status === "ESCALATED" &&
      escalation?.explanation &&
      escalation?.review_status === "PENDING" &&
      (await canReviewEscalation(user, task)),
    canAddSubtask: !["DONE", "CANCELLED", "REJECTED"].includes(task.status) && !task.parent_id,
    canDelete: isBoss,
    canViewActivity: isBoss,
    openSubtasks: openSubs,
  };

  const safeTask = { ...task };
  if (!permissions.canViewInputRequest) safeTask.input_request_note = null;
  if (!permissions.canViewInputPayload) safeTask.input_payload = null;

  return {
    task: safeTask,
    members,
    subtasks,
    comments,
    activity,
    attachments,
    escalation: escalation ?? null,
    batchTasks,
    permissions,
  };
};

async function maybeAutoCompleteParent(parentId, actorId, lastSubtaskId) {
  const parent = await Task.findByPk(parentId);
  if (!parent || parent.deleted || ["DONE", "CANCELLED"].includes(parent.status)) return;

  const [counts] = await sequelize.query(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END)::int AS done
     FROM tasks WHERE parent_id = :pid AND deleted = false`,
    { replacements: { pid: parentId }, type: QueryTypes.SELECT }
  );

  if (!counts?.total || counts.done !== counts.total) return;

  const t = now();
  await Task.update(
    { status: "DONE", done_at: t, blocked_reason: null, updated_at: t },
    { where: { id: parentId } }
  );
  await logActivity(parentId, actorId, "DONE", {
    autoFromSubtasks: true,
    subtaskId: lastSubtaskId,
    subtaskTotal: counts.total,
  });
  await notify(
    [parent.creator_id, parent.assignee_id, await managerOf(parent.assignee_id)],
    "DONE",
    `Done: "${parent.title}"`,
    "All subtasks are complete.",
    parent.id,
    actorId
  );
}

export const patchTask = async (user, taskId, body) => {
  const task = await loadTask(taskId);
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const t = now();
  const action = body.action;

  const members = await loadTaskMembers(task.id);
  const isAssignee = task.assignee_id === user.id;
  const canActAsAssignee = canActAsTaskAssignee(user, task, members);
  const isCreator = task.creator_id === user.id;
  const isBoss = ["ADMIN", "CEO"].includes(user.role);

  if ((await explanationPending(task)) && canActAsAssignee && action !== "noop") {
    throw new ApiError(
      httpStatus.LOCKED,
      "This task is escalated. You must submit an explanation before any other action.",
      true,
      "",
      "EXPLANATION_REQUIRED"
    );
  }

  switch (action) {
    case "acknowledge": {
      if (!["ASSIGNED", "DISCUSS"].includes(task.status)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Task is not awaiting acceptance");
      }
      const claimable = task.assigned_team_id && task.assigned_team_id === user.team_id;
      if (!canActAsAssignee && !claimable && !isBoss) {
        throw new ApiError(httpStatus.FORBIDDEN, "Only the assignee can accept this task");
      }
      if (!body.etaAt) throw new ApiError(httpStatus.BAD_REQUEST, "ETA is mandatory when accepting");

      await sequelize.query(
        `UPDATE tasks SET status = 'ACKNOWLEDGED', acknowledged_at = :t, eta_at = :etaAt,
         assignee_id = COALESCE(assignee_id, :uid),
         assigned_team_id = CASE WHEN assignee_id IS NULL THEN NULL ELSE assigned_team_id END,
         discuss_reason = NULL,
         updated_at = :t2 WHERE id = :id`,
        { replacements: { t, etaAt: body.etaAt, uid: user.id, t2: t, id: task.id } }
      );
      await logActivity(task.id, user.id, "ACKNOWLEDGED", { etaAt: body.etaAt });
      await notify([task.creator_id], "ACKNOWLEDGED", `${user.name} accepted "${task.title}"`, "ETA set.", task.id, user.id);
      break;
    }
    case "discuss": {
      if (task.status !== "ASSIGNED") {
        throw new ApiError(httpStatus.BAD_REQUEST, "Only tasks awaiting acceptance can be marked for discussion");
      }
      const claimable = task.assigned_team_id && task.assigned_team_id === user.team_id;
      if (!canActAsAssignee && !claimable && !isBoss) {
        throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      }
      const note = String(body.reason || body.note || "").trim();
      await Task.update(
        { status: "DISCUSS", discuss_reason: note || null, updated_at: t },
        { where: { id: task.id } }
      );
      await logActivity(task.id, user.id, "DISCUSS", { reason: note || null });
      await notify(
        [task.creator_id, await managerOf(task.assignee_id)],
        "DISCUSS",
        `Discuss: "${task.title}"`,
        note || `${user.name} requested a discussion before accepting.`,
        task.id,
        user.id
      );
      break;
    }
    case "reject": {
      if (task.status === "ESCALATED") {
        if (!isBoss) {
          throw new ApiError(httpStatus.FORBIDDEN, "Only Admin or CEO can reject an escalated task");
        }
      } else if (!["ASSIGNED", "DISCUSS"].includes(task.status)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "This task cannot be rejected in its current status");
      }
      const claimable = task.assigned_team_id && task.assigned_team_id === user.team_id;
      if (task.status !== "ESCALATED" && !canActAsAssignee && !claimable && !isBoss) {
        throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      }
      if (!body.reason) throw new ApiError(httpStatus.BAD_REQUEST, "A reason is required to reject");
      await Task.update(
        {
          status: "REJECTED",
          cancelled_at: t,
          cancel_reason: body.reason,
          discuss_reason: null,
          blocked_reason: null,
          updated_at: t,
        },
        { where: { id: task.id } }
      );
      await logActivity(task.id, user.id, "REJECTED", { reason: body.reason });
      await notify(
        [task.creator_id, await managerOf(task.assignee_id)],
        "REJECTED",
        `Rejected: "${task.title}"`,
        body.reason,
        task.id,
        user.id
      );
      break;
    }
    case "start": {
      if (task.status === "ESCALATED") {
        if (!isBoss) {
          throw new ApiError(httpStatus.FORBIDDEN, "Only Admin or CEO can mark an escalated task in progress");
        }
        await Task.update(
          { status: "IN_PROGRESS", started_at: task.started_at || t, updated_at: t },
          { where: { id: task.id } }
        );
        await logActivity(task.id, user.id, "STARTED", { fromEscalated: true });
        break;
      }
      if (task.status !== "ACKNOWLEDGED") throw new ApiError(httpStatus.BAD_REQUEST, "Accept the task first");
      if (!canActAsAssignee && !isBoss) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      await Task.update({ status: "IN_PROGRESS", started_at: t, updated_at: t }, { where: { id: task.id } });
      await logActivity(task.id, user.id, "STARTED", {});
      break;
    }
    case "done": {
      if (["DONE", "CANCELLED", "REJECTED"].includes(task.status)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Task already closed");
      }
      if (!canActAsAssignee && !isCreator && !isBoss && !(await isManagerOf(user, task.assignee_id))) {
        throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      }
      const [countRow] = await sequelize.query(
        "SELECT COUNT(*)::int AS c FROM tasks WHERE parent_id = :id AND status NOT IN ('DONE','CANCELLED','REJECTED') AND deleted = false",
        { replacements: { id: task.id }, type: QueryTypes.SELECT }
      );
      const openSubs = countRow?.c ?? 0;
      if (openSubs > 0) {
        const mayOverride = (isCreator || isBoss) && body.overrideReason;
        if (!mayOverride) {
          throw new ApiError(
            httpStatus.CONFLICT,
            `${openSubs} subtask(s) still open. Complete them first (creator/Admin may override with a reason).`,
            true,
            "",
            "OPEN_SUBTASKS"
          );
        }
        await logActivity(task.id, user.id, "DONE_OVERRIDE", { reason: body.overrideReason, openSubs });
      }
      await Task.update(
        { status: "DONE", done_at: t, blocked_reason: null, updated_at: t },
        { where: { id: task.id } }
      );
      await logActivity(task.id, user.id, "DONE", {});
      await notify(
        [task.creator_id, await managerOf(task.assignee_id)],
        "DONE",
        `Done: "${task.title}"`,
        `Marked done by ${user.name}.`,
        task.id,
        user.id
      );
      if (task.parent_id) {
        const parent = await Task.findByPk(task.parent_id);
        const [counts] = await sequelize.query(
          "SELECT COUNT(*)::int AS total, SUM(CASE WHEN status='DONE' THEN 1 ELSE 0 END)::int AS done FROM tasks WHERE parent_id = :pid AND deleted = false",
          { replacements: { pid: task.parent_id }, type: QueryTypes.SELECT }
        );
        await notify(
          [parent.assignee_id, parent.creator_id],
          "SUBTASK_DONE",
          `Subtask done on "${parent.title}" (${counts.done}/${counts.total})`,
          task.title,
          parent.id,
          user.id
        );
        await logActivity(parent.id, user.id, "SUBTASK_DONE", {
          subtaskId: task.id,
          done: counts.done,
          total: counts.total,
        });
        await maybeAutoCompleteParent(task.parent_id, user.id, task.id);
      }
      break;
    }
    case "update_eta": {
      if (task.status === "ESCALATED") {
        if (!["ADMIN", "CEO"].includes(user.role)) {
          throw new ApiError(httpStatus.FORBIDDEN, "Only Admin or CEO can update ETA on escalated tasks");
        }
      } else if (task.status === "ASSIGNED") {
        if (!["ADMIN", "CEO"].includes(user.role)) {
          throw new ApiError(
            httpStatus.FORBIDDEN,
            "Only Admin or CEO can update ETA while the task is awaiting acceptance"
          );
        }
      } else if (!(await canEditEta(user, task, members))) {
        throw new ApiError(httpStatus.FORBIDDEN, "You cannot edit the ETA of this task");
      }
      if (!body.etaAt) throw new ApiError(httpStatus.BAD_REQUEST, "etaAt required");
      const etaUpdate = { eta_at: body.etaAt, updated_at: t };
      if (task.status === "ESCALATED") {
        etaUpdate.due_at = body.etaAt;
        etaUpdate.due_soon_sent = false;
      }
      await Task.update(etaUpdate, { where: { id: task.id } });
      await logActivity(task.id, user.id, "ETA_CHANGED", {
        from: task.eta_at,
        to: body.etaAt,
        ...(task.status === "ESCALATED" ? { dueFrom: task.due_at, dueTo: body.etaAt } : {}),
      });
      await notify(
        [task.assignee_id, task.creator_id],
        "ETA_CHANGED",
        `ETA updated on "${task.title}"`,
        `Changed by ${user.name}.`,
        task.id,
        user.id
      );
      break;
    }
    case "update_due": {
      if (!isCreator && !isBoss && !(await isManagerOf(user, task.assignee_id))) {
        throw new ApiError(httpStatus.FORBIDDEN, "Only creator/manager/CEO/Admin can change the due date");
      }
      if (!body.dueAt) throw new ApiError(httpStatus.BAD_REQUEST, "dueAt required");
      await Task.update({ due_at: body.dueAt, due_soon_sent: false, updated_at: t }, { where: { id: task.id } });
      await logActivity(task.id, user.id, "DUE_CHANGED", { from: task.due_at, to: body.dueAt });
      await notify([task.assignee_id], "DUE_CHANGED", `Due date updated on "${task.title}"`, "", task.id, user.id);
      break;
    }
    case "reopen": {
      if (task.status !== "DONE") throw new ApiError(httpStatus.BAD_REQUEST, "Only done tasks can be reopened");
      if (!isCreator && !isBoss && !(await isManagerOf(user, task.assignee_id))) {
        throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      }
      if (!body.reason) throw new ApiError(httpStatus.BAD_REQUEST, "A reason is required to reopen");
      await sequelize.query(
        "UPDATE tasks SET status = 'IN_PROGRESS', done_at = NULL, reopen_count = reopen_count + 1, updated_at = :t WHERE id = :id",
        { replacements: { t, id: task.id } }
      );
      await logActivity(task.id, user.id, "REOPENED", { reason: body.reason });
      await notify([task.assignee_id], "REOPENED", `Reopened: "${task.title}"`, body.reason, task.id, user.id);
      break;
    }
    case "cancel": {
      if (!isCreator && !isBoss) {
        throw new ApiError(httpStatus.FORBIDDEN, "Only the creator, Admin, or CEO can cancel");
      }
      if (!body.reason) throw new ApiError(httpStatus.BAD_REQUEST, "A reason is required to cancel");
      await Task.update(
        { status: "CANCELLED", cancelled_at: t, cancel_reason: body.reason, updated_at: t },
        { where: { id: task.id } }
      );
      await logActivity(task.id, user.id, "CANCELLED", { reason: body.reason });
      await notify([task.assignee_id], "CANCELLED", `Cancelled: "${task.title}"`, body.reason, task.id, user.id);
      break;
    }
    case "block": {
      if (!canActAsAssignee) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      if (!body.reason) throw new ApiError(httpStatus.BAD_REQUEST, "Describe what is blocking you");
      await Task.update({ blocked_reason: body.reason, updated_at: t }, { where: { id: task.id } });
      await logActivity(task.id, user.id, "BLOCKED", { reason: body.reason });
      await notify(
        [task.creator_id, await managerOf(task.assignee_id)],
        "BLOCKED",
        `Blocked: "${task.title}"`,
        body.reason,
        task.id,
        user.id
      );
      break;
    }
    case "unblock": {
      if (!canActAsAssignee && !isBoss) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      await Task.update({ blocked_reason: null, updated_at: t }, { where: { id: task.id } });
      await logActivity(task.id, user.id, "UNBLOCKED", {});
      break;
    }
    case "reassign": {
      if (!(await canReassignTask(user, task))) {
        throw new ApiError(httpStatus.FORBIDDEN, "You cannot reassign this task");
      }

      const newAssigneeId = Number(body.assigneeId);
      if (!newAssigneeId) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Choose an assignee");
      }

      if (task.assignee_id === newAssigneeId) {
        break;
      }

      const newAssignee = await User.findOne({
        where: { id: newAssigneeId, is_active: true },
      });
      if (!newAssignee) {
        throw new ApiError(httpStatus.BAD_REQUEST, "User not found");
      }

      if (task.task_type_id) {
        const type = await TaskType.findOne({
          where: { id: task.task_type_id, is_active: true },
        });
        if (type && type.team_id !== newAssignee.team_id) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "This task type belongs to a different team than the assignee"
          );
        }
      }

      const oldAssigneeId = task.assignee_id;
      const sla = addWorkingMinutes(t, 30);

      await Task.update(
        {
          assignee_id: newAssigneeId,
          assigned_team_id: null,
          status: "ASSIGNED",
          eta_at: null,
          acknowledged_at: null,
          started_at: null,
          discuss_reason: null,
          blocked_reason: null,
          escalated_at: null,
          input_request_note: null,
          input_requested_at: null,
          input_provided_at: null,
          input_provided_by: null,
          input_payload: null,
          sla_deadline_at: sla,
          sla_breached_at: null,
          warn_sent: false,
          due_soon_sent: false,
          updated_at: t,
        },
        { where: { id: task.id } }
      );

      await logActivity(task.id, user.id, "REASSIGNED", {
        fromAssigneeId: oldAssigneeId,
        toAssigneeId: newAssigneeId,
        toName: newAssignee.name,
      });

      await notify(
        [newAssigneeId],
        "ASSIGNED",
        `Task reassigned: "${task.title}"`,
        `Reassigned by ${user.name}. Accept within 30 working minutes.`,
        task.id,
        user.id
      );

      if (oldAssigneeId && oldAssigneeId !== newAssigneeId) {
        await notify(
          [oldAssigneeId],
          "REASSIGNED",
          `Unassigned from "${task.title}"`,
          `Reassigned by ${user.name}.`,
          task.id,
          user.id
        );
      }
      break;
    }
    case "add_member": {
      if (!canManageTaskMembers(user, task, members)) {
        throw new ApiError(httpStatus.FORBIDDEN, "You cannot manage members on this task");
      }
      const memberUserId = Number(body.userId);
      const role = VALID_MEMBER_ROLES.has(String(body.role || "").toUpperCase())
        ? String(body.role).toUpperCase()
        : "COLLABORATOR";
      if (!memberUserId) throw new ApiError(httpStatus.BAD_REQUEST, "Choose a user");
      if (memberUserId === task.assignee_id) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Primary assignee is already on the task");
      }
      const memberUser = await User.findOne({ where: { id: memberUserId, is_active: true } });
      if (!memberUser) throw new ApiError(httpStatus.BAD_REQUEST, "User not found");

      await sequelize.query(
        `INSERT INTO task_members (task_id, user_id, role, added_by, created_at)
         VALUES (:taskId, :userId, :role, :addedBy, :createdAt)
         ON CONFLICT (task_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        {
          replacements: {
            taskId: task.id,
            userId: memberUserId,
            role,
            addedBy: user.id,
            createdAt: t,
          },
        }
      );
      await logActivity(task.id, user.id, "MEMBER_ADDED", { userId: memberUserId, role, name: memberUser.name });
      await notify(
        [memberUserId],
        "TASK_MEMBER",
        `Added to task: "${task.title}"`,
        `You were added as a ${role.toLowerCase()} by ${user.name}.`,
        task.id,
        user.id
      );
      break;
    }
    case "remove_member": {
      if (!canManageTaskMembers(user, task, members)) {
        throw new ApiError(httpStatus.FORBIDDEN, "You cannot manage members on this task");
      }
      const memberUserId = Number(body.userId);
      if (!memberUserId) throw new ApiError(httpStatus.BAD_REQUEST, "Choose a user");
      const [removed] = await sequelize.query(
        `DELETE FROM task_members WHERE task_id = :taskId AND user_id = :userId RETURNING user_id`,
        { replacements: { taskId: task.id, userId: memberUserId }, type: QueryTypes.SELECT }
      );
      if (!removed) throw new ApiError(httpStatus.NOT_FOUND, "Member not on this task");
      await logActivity(task.id, user.id, "MEMBER_REMOVED", { userId: memberUserId });
      break;
    }
    case "request_input": {
      if (!canActAsAssignee) throw new ApiError(httpStatus.FORBIDDEN, "Only the assignee can request input");
      if (!["ACKNOWLEDGED", "IN_PROGRESS"].includes(task.status)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Input can only be requested on accepted or in-progress tasks");
      }
      const note = String(body.inputRequestNote || body.reason || "").trim();
      if (note.length < 10) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Describe what you need (at least 10 characters)");
      }
      await Task.update(
        {
          status: "WAITING_FOR_INPUT",
          input_request_note: note,
          input_requested_at: t,
          input_provided_at: null,
          input_provided_by: null,
          input_payload: null,
          blocked_reason: null,
          updated_at: t,
        },
        { where: { id: task.id } }
      );
      await logActivity(task.id, user.id, "INPUT_REQUESTED", { note });
      await notify(
        [task.creator_id, ...(await ceoIds())],
        "INPUT_REQUESTED",
        `Input needed: "${task.title}"`,
        note,
        task.id,
        user.id
      );
      break;
    }
    case "provide_input": {
      if (!canProvideTaskInput(user, task)) {
        throw new ApiError(httpStatus.FORBIDDEN, "Only the creator or Admin can provide input");
      }
      if (task.status !== "WAITING_FOR_INPUT") {
        throw new ApiError(httpStatus.BAD_REQUEST, "This task is not waiting for input");
      }
      const payload = String(body.inputPayload || "").trim();
      if (payload.length < 1) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Provide the requested information");
      }
      await Task.update(
        {
          status: "INPUT_PROVIDED",
          input_payload: payload,
          input_provided_at: t,
          input_provided_by: user.id,
          updated_at: t,
        },
        { where: { id: task.id } }
      );
      await logActivity(task.id, user.id, "INPUT_PROVIDED", {});
      if (task.assignee_id) {
        await notify(
          [task.assignee_id],
          "INPUT_PROVIDED",
          `Input provided: "${task.title}"`,
          "Review the data and continue working.",
          task.id,
          user.id
        );
      }
      break;
    }
    case "resume_after_input": {
      if (!canActAsAssignee) throw new ApiError(httpStatus.FORBIDDEN, "Only the assignee can continue");
      if (task.status !== "INPUT_PROVIDED") {
        throw new ApiError(httpStatus.BAD_REQUEST, "No input has been provided yet");
      }
      const nextStatus = task.started_at ? "IN_PROGRESS" : "ACKNOWLEDGED";
      await Task.update(
        {
          status: nextStatus,
          updated_at: t,
        },
        { where: { id: task.id } }
      );
      await logActivity(task.id, user.id, "INPUT_ACKNOWLEDGED", { resumedStatus: nextStatus });
      break;
    }
    case "update_details": {
      if (!isCreator) {
        throw new ApiError(httpStatus.FORBIDDEN, "Only the task creator can edit the title and description");
      }
      if (["DONE", "CANCELLED", "REJECTED"].includes(task.status)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Closed tasks cannot be edited");
      }
      const title = String(body.title ?? "").trim();
      const description = String(body.description ?? "").trim();
      if (!title) throw new ApiError(httpStatus.BAD_REQUEST, "Title is required");
      await Task.update(
        { title, description: description || null, updated_at: t },
        { where: { id: task.id } }
      );

      const addIds = Array.isArray(body.descriptionAttachmentIds)
        ? body.descriptionAttachmentIds.map(Number).filter(Boolean)
        : [];
      if (addIds.length) {
        const { linkAttachmentsToTask } = await import("./uploadsService.js");
        await linkAttachmentsToTask(task.id, addIds, user.id, "description");
      }

      const removeIds = Array.isArray(body.removeAttachmentIds)
        ? body.removeAttachmentIds.map(Number).filter(Boolean)
        : [];
      if (removeIds.length) {
        const { deleteAttachmentById } = await import("./uploadsService.js");
        for (const attachmentId of removeIds) {
          const [row] = await sequelize.query(
            "SELECT id FROM attachments WHERE id = :attachmentId AND task_id = :taskId AND context = 'description'",
            {
              replacements: { attachmentId, taskId: task.id },
              type: QueryTypes.SELECT,
            }
          );
          if (row) await deleteAttachmentById(user, attachmentId);
        }
      }

      await logActivity(task.id, user.id, "DETAILS_UPDATED", {
        fromTitle: task.title,
        toTitle: title,
        descriptionChanged: (task.description || "") !== description,
      });
      break;
    }
    default:
      throw new ApiError(httpStatus.BAD_REQUEST, "Unknown action");
  }

  const updatedTask = await loadTask(task.id);
  try {
    const { emitTaskChanged } = await import("../lib/socket.js");
    await emitTaskChanged({ action, task: updatedTask, actor: user });
  } catch {
    // socket optional
  }

  return { ok: true, task: updatedTask };
};

export const deleteTask = async (user, taskId) => {
  if (!["ADMIN", "CEO"].includes(user.role)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Admin or CEO only");
  }

  const task = await loadTask(taskId, { includeDeleted: true });
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  if (task.deleted) throw new ApiError(httpStatus.BAD_REQUEST, "Task already deleted");

  const t = now();
  await sequelize.query(
    `UPDATE tasks SET deleted = true, updated_at = :t
     WHERE id = :id OR parent_id = :id`,
    { replacements: { t, id: taskId } }
  );
  await logActivity(taskId, user.id, "DELETED", {});

  return { ok: true };
};

async function assertActiveTask(task) {
  if (!task || task.deleted) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  return task;
}

async function loadCommentsWithReactions(taskId, userId) {
  const rows = await sequelize.query(
    `SELECT c.id, c.task_id, c.author_id, c.parent_comment_id, c.body AS content,
            c.edited, c.edited_at, c.created_at, c.updated_at,
            u.name AS author_name
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.task_id = :taskId ORDER BY c.created_at ASC, c.id ASC`,
    { replacements: { taskId }, type: QueryTypes.SELECT }
  );

  const reactionRows = await sequelize.query(
    `SELECT comment_id, emoji, COUNT(*)::int AS count,
            SUM(CASE WHEN user_id = :userId THEN 1 ELSE 0 END)::int AS mine
     FROM comment_reactions
     WHERE comment_id IN (SELECT id FROM comments WHERE task_id = :taskId)
     GROUP BY comment_id, emoji`,
    { replacements: { userId, taskId }, type: QueryTypes.SELECT }
  );

  const reactionsByComment = {};
  for (const r of reactionRows) {
    if (!reactionsByComment[r.comment_id]) reactionsByComment[r.comment_id] = [];
    reactionsByComment[r.comment_id].push({
      emoji: r.emoji,
      count: r.count,
      mine: r.mine > 0,
    });
  }

  return rows.map((c) => ({
    ...c,
    reactions: reactionsByComment[c.id] || [],
  }));
}

export const listComments = async (user, taskId) => {
  const task = await assertActiveTask(await Task.findByPk(taskId));
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const comments = await loadCommentsWithReactions(task.id, user.id);
  return { comments };
};

export const createComment = async (user, taskId, body) => {
  const task = await assertActiveTask(await Task.findByPk(taskId));
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const members = await loadTaskMembers(task.id);
  if (isTaskWatcher(members, user.id)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Watchers can only view this task");
  }

  const content = String(body.content || body.body || "").trim();
  const parentCommentId = body.parentCommentId ? Number(body.parentCommentId) : null;

  if (!content) throw new ApiError(httpStatus.BAD_REQUEST, "Comment cannot be empty");

  if (parentCommentId) {
    const parent = await Comment.findOne({ where: { id: parentCommentId, task_id: task.id } });
    if (!parent) throw new ApiError(httpStatus.BAD_REQUEST, "Parent comment not found");
  }

  const t = now();
  const comment = await Comment.create({
    task_id: task.id,
    author_id: user.id,
    parent_comment_id: parentCommentId,
    body: content,
    edited: false,
    created_at: t,
    updated_at: t,
  });

  await logActivity(task.id, user.id, "COMMENT", { commentId: comment.id, parentCommentId });
  await notify(
    [task.assignee_id, task.creator_id],
    "COMMENT",
    `Comment on "${task.title}"`,
    content.slice(0, 120),
    task.id,
    user.id
  );

  const comments = await loadCommentsWithReactions(task.id, user.id);
  const created = comments.find((c) => c.id === comment.id);
  return { comment: created };
};

export const updateComment = async (user, taskId, commentId, body) => {
  const task = await assertActiveTask(await Task.findByPk(taskId));
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const members = await loadTaskMembers(task.id);
  if (isTaskWatcher(members, user.id)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Watchers can only view this task");
  }

  const comment = await Comment.findOne({ where: { id: commentId, task_id: taskId } });
  if (!comment) throw new ApiError(httpStatus.NOT_FOUND, "Comment not found");

  if (comment.author_id !== user.id && !["ADMIN", "CEO"].includes(user.role)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
  }

  const content = String(body.content || body.body || "").trim();
  if (!content) throw new ApiError(httpStatus.BAD_REQUEST, "Comment cannot be empty");

  const t = now();
  await comment.update({ body: content, edited: true, edited_at: t, updated_at: t });

  const comments = await loadCommentsWithReactions(task.id, user.id);
  const updated = comments.find((c) => c.id === comment.id);
  return { comment: updated };
};

export const toggleReaction = async (user, taskId, commentId, emoji) => {
  const task = await assertActiveTask(await Task.findByPk(taskId));
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const members = await loadTaskMembers(task.id);
  if (isTaskWatcher(members, user.id)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Watchers can only view this task");
  }

  const comment = await Comment.findOne({ where: { id: commentId, task_id: taskId } });
  if (!comment) throw new ApiError(httpStatus.BAD_REQUEST, "Comment not found");

  if (!emoji || typeof emoji !== "string" || emoji.length > 32) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid emoji");
  }

  const existing = await CommentReaction.findOne({
    where: { comment_id: commentId, user_id: user.id, emoji },
  });

  if (existing) {
    await existing.destroy();
    return { toggled: "removed", emoji };
  }

  await CommentReaction.create({
    comment_id: commentId,
    user_id: user.id,
    emoji,
    created_at: now(),
  });

  return { toggled: "added", emoji };
};

export const handleEscalation = async (user, taskId, body) => {
  const t = now();
  const task = await assertActiveTask(await Task.findByPk(taskId));
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const [esc] = await sequelize.query(
    "SELECT * FROM escalations WHERE task_id = :taskId ORDER BY id DESC LIMIT 1",
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );
  if (!esc) throw new ApiError(httpStatus.BAD_REQUEST, "Task is not escalated");

  if (body.explanation !== undefined) {
    const members = await loadTaskMembers(task.id);
    if (!canActAsTaskAssignee(user, task, members)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Only the assignee submits the explanation");
    }
    if (esc.explanation) throw new ApiError(httpStatus.BAD_REQUEST, "Explanation already submitted");
    const text = String(body.explanation || "").trim();
    if (text.length < 20) throw new ApiError(httpStatus.BAD_REQUEST, "Explanation must be at least 20 characters");
    if (!body.proposedEtaAt) throw new ApiError(httpStatus.BAD_REQUEST, "Propose a new ETA along with your explanation");

    await Escalation.update(
      {
        explanation: text,
        explanation_at: t,
        proposed_eta_at: body.proposedEtaAt,
        review_status: "PENDING",
      },
      { where: { id: esc.id } }
    );
    await logActivity(task.id, user.id, "EXPLANATION", { proposedEtaAt: body.proposedEtaAt });
    await notify(
      [task.creator_id, await managerOf(task.assignee_id), ...(await ceoIds())],
      "EXPLANATION",
      `Explanation submitted for "${task.title}"`,
      text.slice(0, 140),
      task.id,
      user.id
    );
    return { ok: true };
  }

  if (body.review) {
    if (!(await canReviewEscalation(user, task))) {
      throw new ApiError(httpStatus.FORBIDDEN, "Only manager/CEO/Admin can review");
    }
    if (!esc.explanation || esc.review_status !== "PENDING") {
      throw new ApiError(httpStatus.BAD_REQUEST, "No explanation pending review");
    }
    if (!["ACCEPTED", "REJECTED"].includes(body.review)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "review must be ACCEPTED or REJECTED");
    }

    await Escalation.update(
      { review_status: body.review, reviewer_id: user.id, reviewed_at: t },
      { where: { id: esc.id } }
    );
    await logActivity(task.id, user.id, "REVIEW", { result: body.review });

    if (body.review === "ACCEPTED") {
      const newDue = body.newDueAt || esc.proposed_eta_at;
      await Task.update(
        {
          status: "IN_PROGRESS",
          due_at: newDue,
          eta_at: esc.proposed_eta_at,
          due_soon_sent: false,
          updated_at: t,
        },
        { where: { id: task.id } }
      );
      await notify(
        [task.assignee_id],
        "REVIEW",
        `Explanation accepted for "${task.title}"`,
        "Task re-planned with the new ETA.",
        task.id,
        user.id
      );
    } else {
      await notify(
        [task.assignee_id],
        "REVIEW",
        `Explanation rejected for "${task.title}"`,
        "This task is flagged for review.",
        task.id,
        user.id
      );
    }
    return { ok: true };
  }

  throw new ApiError(httpStatus.BAD_REQUEST, "Nothing to do");
};

export const getTemplateData = async (user) => {
  if (!["ADMIN", "CEO"].includes(user.role)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Admin or CEO only");
  }

  const users = await sequelize.query(
    `SELECT u.id, u.name, u.email, u.role, u.team_id, u.is_active, tm.name AS team_name
     FROM users u
     LEFT JOIN teams tm ON tm.id = u.team_id
     WHERE u.is_active = true
     ORDER BY u.name`,
    { type: QueryTypes.SELECT }
  );

  const teams = await sequelize.query(
    `SELECT id, name FROM teams ORDER BY name`,
    { type: QueryTypes.SELECT }
  );

  const taskTypes = await sequelize.query(
    `SELECT tt.id, tt.team_id, tt.name, tm.name AS team_name
     FROM task_types tt
     JOIN teams tm ON tm.id = tt.team_id
     WHERE tt.is_active = true
     ORDER BY tm.name, tt.name`,
    { type: QueryTypes.SELECT }
  );

  const projects = await sequelize.query(
    `SELECT p.id, p.name, p.owner_id FROM projects p ORDER BY p.name`,
    { type: QueryTypes.SELECT }
  );

  const memberships = await sequelize.query(
    `SELECT pm.user_id, p.id AS project_id, p.name AS project_name, p.owner_id
     FROM project_members pm
     JOIN projects p ON p.id = pm.project_id`,
    { type: QueryTypes.SELECT }
  );

  const userProjects = {};
  for (const u of users) userProjects[u.id] = [];

  for (const p of projects) {
    if (p.owner_id && userProjects[p.owner_id]) {
      userProjects[p.owner_id].push(p.name);
    }
  }
  for (const m of memberships) {
    if (!userProjects[m.user_id]) userProjects[m.user_id] = [];
    if (!userProjects[m.user_id].includes(m.project_name)) {
      userProjects[m.user_id].push(m.project_name);
    }
  }
  for (const uid of Object.keys(userProjects)) {
    userProjects[uid].sort((a, b) => a.localeCompare(b));
  }

  const teamProjects = {};
  for (const t of teams) teamProjects[t.id] = [];
  for (const u of users) {
    if (!u.team_id) continue;
    for (const name of userProjects[u.id] ?? []) {
      if (!teamProjects[u.team_id].includes(name)) {
        teamProjects[u.team_id].push(name);
      }
    }
  }
  for (const tid of Object.keys(teamProjects)) {
    teamProjects[tid].sort((a, b) => a.localeCompare(b));
  }

  return { users, teams, projects, taskTypes, userProjects, teamProjects };
};

function assigneeLabelForUser(u) {
  return `${u.name}${u.team_name ? ` (${u.team_name})` : ''}`;
}

function parseDueLabel(label) {
  const s = String(label || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    0,
    0
  );
  const ts = d.getTime();
  return Number.isNaN(ts) ? null : ts;
}

export const importTasks = async (user, { rows }) => {
  if (!["ADMIN", "CEO"].includes(user.role)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Admin or CEO only");
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No rows to import");
  }
  if (rows.length > 200) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Maximum 200 tasks per import");
  }

  const { users, teams, taskTypes, projects } = await getTemplateData(user);

  const userByLabel = new Map(users.map((u) => [assigneeLabelForUser(u), u]));
  const teamByLabel = new Map(teams.map((t) => [`Team: ${t.name}`, t]));
  const projectByName = new Map(projects.map((p) => [p.name, p]));

  const createdIds = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const excelRow = i + 2;
    const row = rows[i];
    try {
      const assigneeLabel = String(row.assigneeLabel || "").trim();
      if (!assigneeLabel) throw new ApiError(httpStatus.BAD_REQUEST, "Assign to is required");

      let assigneeId = null;
      let teamId = null;
      let assigneeTeamId = null;

      if (teamByLabel.has(assigneeLabel)) {
        teamId = teamByLabel.get(assigneeLabel).id;
        assigneeTeamId = teamId;
      } else if (userByLabel.has(assigneeLabel)) {
        const u = userByLabel.get(assigneeLabel);
        assigneeId = u.id;
        assigneeTeamId = u.team_id;
      } else {
        throw new ApiError(httpStatus.BAD_REQUEST, `Unknown assignee "${assigneeLabel}"`);
      }

      const dueAt = parseDueLabel(row.dueAtLabel);
      if (!dueAt) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Invalid due date "${row.dueAtLabel}" — use YYYY-MM-DD HH:MM`
        );
      }

      let taskTypeId = null;
      const typeName = String(row.taskTypeName || "").trim();
      if (typeName && typeName.toLowerCase() !== "(optional)") {
        const match = taskTypes.find(
          (t) => t.name === typeName && t.team_id === assigneeTeamId
        );
        if (!match) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Unknown task type "${typeName}" for this assignee`
          );
        }
        taskTypeId = match.id;
      }

      let projectId = null;
      const projectName = String(row.projectName || "").trim();
      if (projectName && projectName.toLowerCase() !== "none") {
        const project = projectByName.get(projectName);
        if (!project) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Unknown project "${projectName}"`);
        }
        projectId = project.id;
      }

      const pri = String(row.priority || "NORMAL").trim().toUpperCase();
      const priority = ["URGENT", "HIGH", "NORMAL", "LOW"].includes(pri) ? pri : "NORMAL";

      const result = await createTask(user, {
        title: String(row.title || "").trim(),
        description: String(row.description || ""),
        assigneeId,
        teamId,
        priority,
        dueAt,
        projectId,
        taskTypeId,
      });
      createdIds.push(...(result.ids || []));
    } catch (e) {
      errors.push({
        row: excelRow,
        message: e instanceof ApiError ? e.message : e?.message || "Import failed",
      });
    }
  }

  if (createdIds.length === 0 && errors.length > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, errors[0].message);
  }

  return { created: createdIds.length, ids: createdIds, errors };
};

export default {
  listTasks,
  createTask,
  getTaskDetail,
  patchTask,
  deleteTask,
  listComments,
  getTemplateData,
  importTasks,
  createComment,
  toggleReaction,
  handleEscalation,
};
