import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ChatConversation = sequelize.define(
  "ChatConversation",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    kind: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "direct" },
    name: { type: DataTypes.STRING(140), allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    /** Legacy support-chat field; direct chats use user_one_id / user_two_id */
    member_user_id: { type: DataTypes.INTEGER, allowNull: true },
    user_one_id: { type: DataTypes.INTEGER, allowNull: true },
    user_two_id: { type: DataTypes.INTEGER, allowNull: true },
    last_message_at: { type: DataTypes.BIGINT, allowNull: false },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "chat_conversations" }
);

export default ChatConversation;
