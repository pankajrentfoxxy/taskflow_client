import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Notification = sequelize.define(
  "Notification",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    task_id: { type: DataTypes.INTEGER, allowNull: true },
    read_at: { type: DataTypes.BIGINT, allowNull: true },
    is_visible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "notifications" }
);

export default Notification;
