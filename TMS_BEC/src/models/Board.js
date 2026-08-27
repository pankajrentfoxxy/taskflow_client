import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Board = sequelize.define(
  "Board",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    scene: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
    updated_at: { type: DataTypes.BIGINT, allowNull: false },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "boards" }
);

export default Board;
