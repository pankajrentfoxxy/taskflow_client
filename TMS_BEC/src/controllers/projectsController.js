import catchAsync from "../utils/catchAsync.js";
import * as projectsService from "../services/projectsService.js";

export const listProjects = catchAsync(async (req, res) => {
  res.json(await projectsService.listProjects(req.user));
});

export const createProject = catchAsync(async (req, res) => {
  res.json(await projectsService.createProject(req.user, req.body));
});

export const getProject = catchAsync(async (req, res) => {
  res.json(await projectsService.getProject(req.user, Number(req.params.id)));
});

export const updateProject = catchAsync(async (req, res) => {
  res.json(await projectsService.updateProject(req.user, Number(req.params.id), req.body));
});

export default { listProjects, createProject, getProject, updateProject };
