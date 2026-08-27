import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Escalation = sequelize.define(
  "Escalation",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    task_id: { type: DataTypes.INTEGER, allowNull: false },
    explanation: { type: DataTypes.TEXT, allowNull: true },
    explanation_at: { type: DataTypes.BIGINT, allowNull: true },
    proposed_eta_at: { type: DataTypes.BIGINT, allowNull: true },
    review_status: { type: DataTypes.STRING, allowNull: true },
    reviewer_id: { type: DataTypes.INTEGER, allowNull: true },
    reviewed_at: { type: DataTypes.BIGINT, allowNull: true },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "escalations" }
);

export default Escalation;
