import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const TaskMember = sequelize.define(
  "TaskMember",
  {
    task_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: "COLLABORATOR" },
    added_by: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "task_members" }
);

export default TaskMember;
