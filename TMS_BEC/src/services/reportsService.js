import { QueryTypes } from "sequelize";
import httpStatus from "http-status";
import sequelize from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import { runSlaSweep } from "../lib/cron.js";
import { now } from "../lib/time.js";

function resolveAssignDateWindow({ days, createdFrom, createdTo, t }) {
  if (createdFrom && createdTo) {
    return {
      since: Number(createdFrom),
      until: Number(createdTo),
      hasRange: true,
    };
  }
  if (days > 0) {
    return {
      since: t - days * 24 * 3600 * 1000,
      until: t,
      hasRange: true,
    };
  }
  return { since: 0, until: null, hasRange: false };
}

function eventInRangeSql(column, window) {
  if (!window.hasRange) return null;
  if (window.until != null) {
    return `${column} >= :since AND ${column} <= :until`;
  }
  return `${column} >= :since`;
}

/** Assign-date filter for open/total; event-date filter for overdue / SLA / escalation / done when a date range is set. */
function buildReportDateFilters({ days, createdFrom, createdTo, overall, t }) {
  const window = resolveAssignDateWindow({ days, createdFrom, createdTo, t });
  const useAssignFilter = !overall && window.hasRange;

  const assignSql = useAssignFilter
    ? window.until != null
      ? "t.created_at >= :since AND t.created_at <= :until"
      : "t.created_at >= :since"
    : "1=1";

  const dateParams = window.hasRange
    ? window.until != null
      ? { since: window.since, until: window.until }
      : { since: window.since }
    : {};

  const overdueEventSql = eventInRangeSql("t.due_at", window);
  const slaEventSql = eventInRangeSql("t.sla_breached_at", window);
  const escalatedEventSql = eventInRangeSql("t.escalated_at", window);
  const doneEventSql = eventInRangeSql("t.done_at", window);

  return {
    window,
    useAssignFilter,
    assignSql,
    dateParams,
    overdueEventSql,
    slaEventSql,
    escalatedEventSql,
    doneEventSql,
  };
}

/** Date clause for list drill-down: event dates for status metrics, assign date for open/total. */
function listDateClause(listMetric, filters) {
  const { assignSql, overdueEventSql, slaEventSql, escalatedEventSql, doneEventSql, window } =
    filters;
  if (!window.hasRange) return assignSql;
  if (listMetric === "overdue" && overdueEventSql) return overdueEventSql;
  if (listMetric === "no_response" && slaEventSql) return slaEventSql;
  if (listMetric === "esc_awaiting" && escalatedEventSql) return escalatedEventSql;
  if (listMetric === "esc_pending" && escalatedEventSql) return escalatedEventSql;
  if (listMetric === "done" && doneEventSql) return doneEventSql;
  return assignSql;
}

export const getReports = async (
  user,
  { days = 0, createdFrom, createdTo, overall, teamId, taskTypeId, listMetric, personId }
) => {
  await runSlaSweep();

  const t = now();
  const hasDateRange = !!(createdFrom && createdTo) || days > 0;
  const useOverall = overall === true || overall === "true" || overall === "1" || !hasDateRange;
  const filters = buildReportDateFilters({
    days,
    createdFrom,
    createdTo,
    overall: useOverall,
    t,
  });
  const { assignSql, dateParams, window, overdueEventSql, slaEventSql, escalatedEventSql, doneEventSql } =
    filters;

  const overdueDateSql = overdueEventSql || "1=1";
  const slaDateSql = slaEventSql || "1=1";
  const escalatedDateSql = escalatedEventSql || "1=1";
  const doneDateSql = doneEventSql || "1=1";

  const teamFilter = teamId ? Number(teamId) : null;
  const typeFilter = taskTypeId ? Number(taskTypeId) : null;

  let scope = "t.deleted = false";
  const sp = {};

  if (user.role === "MEMBER") {
    scope += " AND t.assignee_id = :scopeUid";
    sp.scopeUid = user.id;
  } else if (user.role === "MANAGER" && user.team_id) {
    scope += " AND (t.assignee_id IN (SELECT id FROM users WHERE team_id = :scopeTeamId) OR t.assigned_team_id = :scopeTeamId2)";
    sp.scopeTeamId = user.team_id;
    sp.scopeTeamId2 = user.team_id;
  }

  if (teamFilter && ["ADMIN", "CEO"].includes(user.role)) {
    scope += " AND (t.assignee_id IN (SELECT id FROM users WHERE team_id = :filterTeamId) OR t.assigned_team_id = :filterTeamId2)";
    sp.filterTeamId = teamFilter;
    sp.filterTeamId2 = teamFilter;
  }
  if (typeFilter) {
    scope += " AND t.task_type_id = :typeFilter";
    sp.typeFilter = typeFilter;
  }

  const baseRepl = { ...sp, ...dateParams };

  if (listMetric) {
    let extra = "";
    const ep = {};
    if (personId) {
      extra = " AND t.assignee_id = :personId";
      ep.personId = Number(personId);
    }

    let cond = "";
    const cp = {};
    switch (listMetric) {
      case "total":
        cond = "1=1";
        break;
      case "open":
        cond = "t.status NOT IN ('DONE','CANCELLED')";
        break;
      case "overdue":
        cond = "t.status NOT IN ('DONE','CANCELLED') AND t.due_at < :overdueNow";
        cp.overdueNow = t;
        break;
      case "no_response":
        cond = "t.status = 'ASSIGNED' AND t.sla_breached_at IS NOT NULL";
        break;
      case "esc_awaiting":
        cond =
          "t.status = 'ESCALATED' AND EXISTS (SELECT 1 FROM escalations e WHERE e.task_id = t.id AND e.id = (SELECT MAX(id) FROM escalations WHERE task_id = t.id) AND e.explanation IS NULL)";
        break;
      case "esc_pending":
        cond =
          "t.status = 'ESCALATED' AND EXISTS (SELECT 1 FROM escalations e WHERE e.task_id = t.id AND e.id = (SELECT MAX(id) FROM escalations WHERE task_id = t.id) AND e.explanation IS NOT NULL AND e.review_status = 'PENDING')";
        break;
      case "due_week":
        cond = "t.status NOT IN ('DONE','CANCELLED') AND t.due_at BETWEEN :weekStart AND :weekEnd";
        cp.weekStart = t;
        cp.weekEnd = t + 7 * 24 * 3600 * 1000;
        break;
      case "done":
        cond = "t.status = 'DONE'";
        break;
      case "escalations":
        cond = "t.escalated_at IS NOT NULL";
        break;
      default:
        throw new ApiError(httpStatus.BAD_REQUEST, "Unknown metric");
    }

    const dateClause = listDateClause(listMetric, filters);

    const tasks = await sequelize.query(
      `SELECT t.id, t.title, t.status, t.due_at, t.eta_at, t.sla_breached_at,
        ua.name AS assignee_name, tt.name AS type_name
       FROM tasks t
       LEFT JOIN users ua ON ua.id = t.assignee_id
       LEFT JOIN task_types tt ON tt.id = t.task_type_id
       WHERE ${scope}${extra} AND (${dateClause}) AND ${cond}
       ORDER BY t.due_at ASC LIMIT 200`,
      { replacements: { ...baseRepl, ...ep, ...cp }, type: QueryTypes.SELECT }
    );
    return { tasks };
  }

  const one = async (sql, repl) => {
    const [row] = await sequelize.query(sql, { replacements: repl, type: QueryTypes.SELECT });
    return row;
  };

  const overdue = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t WHERE ${scope} AND t.status NOT IN ('DONE','CANCELLED') AND t.due_at < :t AND (${overdueDateSql})`,
      { ...baseRepl, t }
    )
  ).c;

  const noResponse = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t WHERE ${scope} AND t.status = 'ASSIGNED' AND t.sla_breached_at IS NOT NULL AND (${slaDateSql})`,
      baseRepl
    )
  ).c;

  const escalatedAwaiting = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t JOIN escalations e ON e.task_id = t.id AND e.id = (SELECT MAX(id) FROM escalations WHERE task_id = t.id)
       WHERE ${scope} AND t.status = 'ESCALATED' AND e.explanation IS NULL AND (${escalatedDateSql})`,
      baseRepl
    )
  ).c;

  const escalatedPendingReview = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t JOIN escalations e ON e.task_id = t.id AND e.id = (SELECT MAX(id) FROM escalations WHERE task_id = t.id)
       WHERE ${scope} AND t.status = 'ESCALATED' AND e.explanation IS NOT NULL AND e.review_status = 'PENDING' AND (${escalatedDateSql})`,
      baseRepl
    )
  ).c;

  const open = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t WHERE ${scope} AND t.status NOT IN ('DONE','CANCELLED') AND (${assignSql})`,
      baseRepl
    )
  ).c;

  const dueThisWeek = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t WHERE ${scope} AND t.status NOT IN ('DONE','CANCELLED') AND t.due_at BETWEEN :t AND :weekEnd AND (${assignSql})`,
      { ...baseRepl, t, weekEnd: t + 7 * 24 * 3600 * 1000 }
    )
  ).c;

  const doneRow = await one(
    `SELECT COUNT(*)::int AS c, SUM(CASE WHEN t.done_at <= t.due_at THEN 1 ELSE 0 END)::int AS ontime
     FROM tasks t WHERE ${scope} AND t.status = 'DONE' AND (${doneDateSql})`,
    baseRepl
  );

  const respRow = await one(
    `SELECT AVG((t.acknowledged_at - t.created_at) / 60000.0) AS m FROM tasks t
     WHERE ${scope} AND t.acknowledged_at IS NOT NULL AND (${assignSql})`,
    baseRepl
  );

  const summary = {
    open,
    overdue,
    noResponse,
    escalatedAwaiting,
    escalatedPendingReview,
    dueThisWeek,
    done: doneRow.c,
    onTimePct: doneRow.c ? Math.round((100 * (doneRow.ontime || 0)) / doneRow.c) : null,
    avgResponseMin: respRow.m != null ? Math.round(respRow.m) : null,
  };

  let people = [];
  const taskJoin = user.role === "MEMBER" ? "LEFT JOIN" : "JOIN";
  let peopleWhere = "u.is_active = true";
  if (user.role === "MEMBER") {
    peopleWhere += " AND u.id = :scopeUid";
  }
  people = await sequelize.query(
    `SELECT u.id, u.name, tm.name AS team_name,
      COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND t.status NOT IN ('DONE','CANCELLED') AND (${assignSql}) THEN 1 ELSE 0 END), 0)::int AS open,
      COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND t.status NOT IN ('DONE','CANCELLED') AND t.due_at < :t AND (${overdueDateSql}) THEN 1 ELSE 0 END), 0)::int AS overdue,
      COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND t.status = 'ASSIGNED' AND t.sla_breached_at IS NOT NULL AND (${slaDateSql}) THEN 1 ELSE 0 END), 0)::int AS no_response,
      COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND t.escalated_at IS NOT NULL AND (${escalatedDateSql}) THEN 1 ELSE 0 END), 0)::int AS escalations,
      COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND t.status = 'DONE' AND (${doneDateSql}) THEN 1 ELSE 0 END), 0)::int AS done,
      COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND t.status = 'DONE' AND t.done_at <= t.due_at AND (${doneDateSql}) THEN 1 ELSE 0 END), 0)::int AS done_ontime,
      ROUND(AVG(CASE WHEN t.id IS NOT NULL AND t.acknowledged_at IS NOT NULL AND (${assignSql}) THEN (t.acknowledged_at - t.created_at) / 60000.0 END))::int AS avg_response_min
     FROM users u
     LEFT JOIN teams tm ON tm.id = u.team_id
     ${taskJoin} tasks t ON t.assignee_id = u.id AND ${scope}
     WHERE ${peopleWhere}
     GROUP BY u.id, tm.name ORDER BY overdue DESC, open DESC`,
    { replacements: { ...baseRepl, t }, type: QueryTypes.SELECT }
  );

  const byTypeWhere = window.hasRange
    ? `${scope} AND ((${assignSql}) OR (t.status = 'DONE' AND (${doneDateSql})))`
    : `${scope} AND (${assignSql})`;

  const byType = await sequelize.query(
    `SELECT tt.id, tt.name, tm.name AS team_name,
      COUNT(*)::int AS total,
      SUM(CASE WHEN t.status NOT IN ('DONE','CANCELLED') THEN 1 ELSE 0 END)::int AS open,
      SUM(CASE WHEN t.status NOT IN ('DONE','CANCELLED') AND t.due_at < :t AND (${overdueDateSql}) THEN 1 ELSE 0 END)::int AS overdue,
      SUM(CASE WHEN t.status = 'ASSIGNED' AND t.sla_breached_at IS NOT NULL AND (${slaDateSql}) THEN 1 ELSE 0 END)::int AS no_response,
      SUM(CASE WHEN t.status = 'DONE' AND (${doneDateSql}) THEN 1 ELSE 0 END)::int AS done
     FROM tasks t
     JOIN task_types tt ON tt.id = t.task_type_id
     JOIN teams tm ON tm.id = tt.team_id
     WHERE ${byTypeWhere}
     GROUP BY tt.id, tt.name, tm.name
     ORDER BY tm.name, tt.name`,
    { replacements: { ...baseRepl, t }, type: QueryTypes.SELECT }
  );

  return { summary, people, byType, scope: user.role };
};

export default { getReports };
