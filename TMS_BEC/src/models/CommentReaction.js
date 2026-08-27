import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const CommentReaction = sequelize.define(
  "CommentReaction",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    comment_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    emoji: { type: DataTypes.STRING, allowNull: false },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  {
    tableName: "comment_reactions",
    indexes: [
      {
        unique: true,
        fields: ["comment_id", "user_id", "emoji"],
      },
    ],
  }
);

export default CommentReaction;
