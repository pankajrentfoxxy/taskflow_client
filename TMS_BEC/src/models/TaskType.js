import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const TaskType = sequelize.define(
  "TaskType",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    team_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    alias: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "task_types" }
);

export default TaskType;
