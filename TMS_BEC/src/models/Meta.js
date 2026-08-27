import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Meta = sequelize.define(
  "Meta",
  {
    key: { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: "meta" }
);

export default Meta;
