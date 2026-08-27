import catchAsync from "../utils/catchAsync.js";
import * as sqlService from "../services/sqlService.js";

export const runQuery = catchAsync(async (req, res) => {
  res.json(await sqlService.runSqlQuery(req.body));
});

export default { runQuery };
