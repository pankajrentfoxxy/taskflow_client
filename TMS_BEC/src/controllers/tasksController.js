import catchAsync from "../utils/catchAsync.js";
import * as taskService from "../services/taskService.js";

export const listTasks = catchAsync(async (req, res) => {
  res.json(
    await taskService.listTasks(req.user, {
      filter: req.query.filter,
      status: req.query.status,
      q: req.query.q,
      projectId: req.query.projectId,
      assigneeId: req.query.assigneeId,
      teamId: req.query.teamId,
      page: req.query.page,
      limit: req.query.limit,
      dueFrom: req.query.dueFrom,
      dueTo: req.query.dueTo,
    })
  );
});

export const createTask = catchAsync(async (req, res) => {
  res.json(await taskService.createTask(req.user, req.body));
});

export const getTask = catchAsync(async (req, res) => {
  res.json(await taskService.getTaskDetail(req.user, Number(req.params.id)));
});

export const patchTask = catchAsync(async (req, res) => {
  res.json(await taskService.patchTask(req.user, Number(req.params.id), req.body));
});

export const deleteTask = catchAsync(async (req, res) => {
  res.json(await taskService.deleteTask(req.user, Number(req.params.id)));
});

export const listComments = catchAsync(async (req, res) => {
  res.json(await taskService.listComments(req.user, Number(req.params.id)));
});

export const createComment = catchAsync(async (req, res) => {
  res.json(await taskService.createComment(req.user, Number(req.params.id), req.body));
});

export const updateComment = catchAsync(async (req, res) => {
  res.json(
    await taskService.updateComment(
      req.user,
      Number(req.params.id),
      Number(req.params.commentId),
      req.body
    )
  );
});

export const toggleReaction = catchAsync(async (req, res) => {
  res.json(
    await taskService.toggleReaction(
      req.user,
      Number(req.params.id),
      Number(req.params.commentId),
      req.body.emoji
    )
  );
});

export const handleEscalation = catchAsync(async (req, res) => {
  res.json(await taskService.handleEscalation(req.user, Number(req.params.id), req.body));
});

export const getTemplateData = catchAsync(async (req, res) => {
  res.json(await taskService.getTemplateData(req.user));
});

export const importTasks = catchAsync(async (req, res) => {
  res.json(await taskService.importTasks(req.user, req.body));
});

export default {
  listTasks,
  createTask,
  getTask,
  patchTask,
  deleteTask,
  listComments,
  createComment,
  updateComment,
  toggleReaction,
  handleEscalation,
  getTemplateData,
  importTasks,
};
