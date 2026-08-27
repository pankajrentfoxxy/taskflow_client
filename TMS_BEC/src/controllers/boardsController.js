import catchAsync from "../utils/catchAsync.js";
import * as boardsService from "../services/boardsService.js";

export const listBoards = catchAsync(async (req, res) => {
  res.json(await boardsService.listBoards(req.user));
});

export const saveBoard = catchAsync(async (req, res) => {
  res.json(await boardsService.saveBoard(req.user, req.body));
});

export const deleteBoard = catchAsync(async (req, res) => {
  res.json(await boardsService.deleteBoard(req.user, req.query.id));
});

export default { listBoards, saveBoard, deleteBoard };
