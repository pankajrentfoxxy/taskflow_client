import catchAsync from "../utils/catchAsync.js";
import * as teamsService from "../services/teamsService.js";

export const listTeams = catchAsync(async (_req, res) => {
  res.json(await teamsService.listTeams());
});

export const createTeam = catchAsync(async (req, res) => {
  res.json(await teamsService.createTeam(req.body));
});

export const updateTeam = catchAsync(async (req, res) => {
  res.json(await teamsService.updateTeam(req.body));
});

export const deleteTeam = catchAsync(async (req, res) => {
  res.json(await teamsService.deleteTeam(Number(req.query.id)));
});

export default { listTeams, createTeam, updateTeam, deleteTeam };
