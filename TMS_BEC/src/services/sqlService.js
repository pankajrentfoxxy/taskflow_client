import httpStatus from "http-status";
import sequelize from "../config/db.js";
import ApiError from "../utils/ApiError.js";

export const runSqlQuery = async ({ query, replacements = {} }) => {
  const sql = String(query || "").trim();
  if (!sql) {
    throw new ApiError(httpStatus.BAD_REQUEST, "SQL query is required");
  }

  const [rows, metadata] = await sequelize.query(sql, {
    replacements: replacements && typeof replacements === "object" ? replacements : {},
  });

  return {
    rows,
    rowCount: Array.isArray(rows) ? rows.length : metadata?.rowCount ?? null,
    metadata,
  };
};

export default { runSqlQuery };
