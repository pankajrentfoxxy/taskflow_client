import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync.js";
import ApiError from "../utils/ApiError.js";
import * as cronService from "../services/cronService.js";

export const slaCheck = catchAsync(async (req, res) => {
  const result = await cronService.runSlaCheck(
    true,
    req.headers.authorization,
    req.query.secret
  );
  if (result.unauthorized) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
  }
  res.json(result);
});

export const ceoDailyReport = catchAsync(async (req, res) => {
  const result = await cronService.runCeoReport(req.headers.authorization, req.query.secret, {
    force: req.query.force === "true",
  });
  if (result.unauthorized) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
  }
  res.json(result);
});

export default { slaCheck, ceoDailyReport };
