import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Project = sequelize.define(
  "Project",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "projects" }
);

export default Project;
