import catchAsync from "../utils/catchAsync.js";
import * as taskTypesService from "../services/taskTypesService.js";

export const listTaskTypes = catchAsync(async (req, res) => {
  res.json(
    await taskTypesService.listTaskTypes(req.user, {
      manage: req.query.manage === "1",
      teamId: req.query.teamId,
      userId: req.query.userId,
    })
  );
});

export const createTaskType = catchAsync(async (req, res) => {
  res.json(await taskTypesService.createTaskType(req.user, req.body));
});

export const updateTaskType = catchAsync(async (req, res) => {
  res.json(await taskTypesService.updateTaskType(req.user, req.body));
});

export const deleteTaskType = catchAsync(async (req, res) => {
  res.json(await taskTypesService.deleteTaskType(req.user, Number(req.query.id)));
});

export default { listTaskTypes, createTaskType, updateTaskType, deleteTaskType };
