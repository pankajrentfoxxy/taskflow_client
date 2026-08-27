import catchAsync from "../utils/catchAsync.js";
import * as usersService from "../services/usersService.js";

export const listUsers = catchAsync(async (_req, res) => {
  res.json(await usersService.listUsers());
});

export const createUser = catchAsync(async (req, res) => {
  res.json(await usersService.createUser(req.body));
});

export const updateUser = catchAsync(async (req, res) => {
  res.json(await usersService.updateUser(req.body));
});

export const deleteUser = catchAsync(async (req, res) => {
  res.json(await usersService.deleteUser(req.user.id, Number(req.query.id)));
});

export default { listUsers, createUser, updateUser, deleteUser };
