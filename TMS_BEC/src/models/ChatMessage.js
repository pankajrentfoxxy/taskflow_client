import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ChatMessage = sequelize.define(
  "ChatMessage",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    conversation_id: { type: DataTypes.INTEGER, allowNull: false },
    author_id: { type: DataTypes.INTEGER, allowNull: false },
    parent_message_id: { type: DataTypes.INTEGER, allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: true },
    edited: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    edited_at: { type: DataTypes.BIGINT, allowNull: true },
    deleted_at: { type: DataTypes.BIGINT, allowNull: true },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
    updated_at: { type: DataTypes.BIGINT, allowNull: true },
  },
  { tableName: "chat_messages" }
);

export default ChatMessage;
