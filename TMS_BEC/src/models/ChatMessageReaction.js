import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ChatMessageReaction = sequelize.define(
  "ChatMessageReaction",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    message_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    emoji: { type: DataTypes.STRING, allowNull: false },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  {
    tableName: "chat_message_reactions",
    indexes: [{ unique: true, fields: ["message_id", "user_id", "emoji"] }],
  }
);

export default ChatMessageReaction;
