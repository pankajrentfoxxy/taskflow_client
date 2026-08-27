import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Comment = sequelize.define(
  "Comment",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    task_id: { type: DataTypes.INTEGER, allowNull: false },
    author_id: { type: DataTypes.INTEGER, allowNull: false },
    parent_comment_id: { type: DataTypes.INTEGER, allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: false },
    edited: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    edited_at: { type: DataTypes.BIGINT, allowNull: true },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
    updated_at: { type: DataTypes.BIGINT, allowNull: true },
  },
  { tableName: "comments" }
);

export default Comment;
