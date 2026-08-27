import catchAsync from "../utils/catchAsync.js";
import * as reportsService from "../services/reportsService.js";

export const getReports = catchAsync(async (req, res) => {
  const hasDateRange =
    !!(req.query.createdFrom && req.query.createdTo) || Number(req.query.days || 0) > 0;
  const overall =
    req.query.overall === "true" || req.query.overall === "1" || !hasDateRange;

  res.json(
    await reportsService.getReports(req.user, {
      days: Number(req.query.days || 0),
      createdFrom: req.query.createdFrom,
      createdTo: req.query.createdTo,
      overall,
      teamId: req.query.teamId,
      taskTypeId: req.query.taskTypeId,
      listMetric: req.query.list,
      personId: req.query.personId,
    })
  );
});

export default { getReports };
