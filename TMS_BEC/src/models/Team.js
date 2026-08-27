import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Team = sequelize.define(
  "Team",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    manager_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "teams" }
);

export default Team;
