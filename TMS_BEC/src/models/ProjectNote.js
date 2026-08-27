import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ProjectNote = sequelize.define(
  "ProjectNote",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    project_id: { type: DataTypes.INTEGER, allowNull: false },
    author_id: { type: DataTypes.INTEGER, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    pinned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "project_notes" }
);

export default ProjectNote;
