import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ChatGroupMember = sequelize.define(
  "ChatGroupMember",
  {
    conversation_id: { type: DataTypes.INTEGER, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, primaryKey: true },
    added_by: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "chat_group_members" }
);

export default ChatGroupMember;
