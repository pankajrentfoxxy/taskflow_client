import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Activity = sequelize.define(
  "Activity",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    task_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_id: { type: DataTypes.INTEGER, allowNull: true },
    type: { type: DataTypes.STRING, allowNull: false },
    meta: { type: DataTypes.TEXT, allowNull: false, defaultValue: "{}" },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "activity" }
);

export default Activity;
