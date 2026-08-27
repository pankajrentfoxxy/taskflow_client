import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Task = sequelize.define(
  "Task",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "ASSIGNED" },
    priority: { type: DataTypes.STRING, allowNull: false, defaultValue: "NORMAL" },
    creator_id: { type: DataTypes.INTEGER, allowNull: false },
    assignee_id: { type: DataTypes.INTEGER, allowNull: true },
    assigned_team_id: { type: DataTypes.INTEGER, allowNull: true },
    project_id: { type: DataTypes.INTEGER, allowNull: true },
    parent_id: { type: DataTypes.INTEGER, allowNull: true },
    batch_id: { type: DataTypes.STRING, allowNull: true },
    board_id: { type: DataTypes.INTEGER, allowNull: true },
    task_type_id: { type: DataTypes.INTEGER, allowNull: true },
    target_count: { type: DataTypes.INTEGER, allowNull: true },
    delivered_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    due_at: { type: DataTypes.BIGINT, allowNull: false },
    eta_at: { type: DataTypes.BIGINT, allowNull: true },
    acknowledged_at: { type: DataTypes.BIGINT, allowNull: true },
    started_at: { type: DataTypes.BIGINT, allowNull: true },
    done_at: { type: DataTypes.BIGINT, allowNull: true },
    cancelled_at: { type: DataTypes.BIGINT, allowNull: true },
    cancel_reason: { type: DataTypes.TEXT, allowNull: true },
    discuss_reason: { type: DataTypes.TEXT, allowNull: true },
    blocked_reason: { type: DataTypes.TEXT, allowNull: true },
    input_request_note: { type: DataTypes.TEXT, allowNull: true },
    input_requested_at: { type: DataTypes.BIGINT, allowNull: true },
    input_provided_at: { type: DataTypes.BIGINT, allowNull: true },
    input_provided_by: { type: DataTypes.INTEGER, allowNull: true },
    input_payload: { type: DataTypes.TEXT, allowNull: true },
    sla_deadline_at: { type: DataTypes.BIGINT, allowNull: true },
    sla_breached_at: { type: DataTypes.BIGINT, allowNull: true },
    warn_sent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    due_soon_sent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    escalated_at: { type: DataTypes.BIGINT, allowNull: true },
    reopen_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
    updated_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "tasks" }
);

export default Task;
