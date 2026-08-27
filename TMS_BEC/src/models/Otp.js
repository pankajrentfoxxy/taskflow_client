import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Otp = sequelize.define(
  "Otp",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING, allowNull: false },
    purpose: { type: DataTypes.STRING, allowNull: false, defaultValue: "PASSWORD_RESET" },
    code_hash: { type: DataTypes.STRING, allowNull: false },
    expires_at: { type: DataTypes.BIGINT, allowNull: false },
    used_at: { type: DataTypes.BIGINT, allowNull: true },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "otps" }
);

export default Otp;
