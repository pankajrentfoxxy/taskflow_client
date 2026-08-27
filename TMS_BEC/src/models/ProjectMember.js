import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ProjectMember = sequelize.define(
  "ProjectMember",
  {
    project_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  },
  { tableName: "project_members" }
);

export default ProjectMember;
