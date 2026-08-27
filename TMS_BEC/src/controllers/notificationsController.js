import catchAsync from "../utils/catchAsync.js";
import * as notificationsService from "../services/notificationsService.js";

export const listNotifications = catchAsync(async (req, res) => {
  res.json(await notificationsService.listNotifications(req.user));
});

export const markRead = catchAsync(async (req, res) => {
  res.json(await notificationsService.markNotificationsRead(req.user, req.body));
});

export const clearAll = catchAsync(async (req, res) => {
  res.json(await notificationsService.clearNotifications(req.user));
});

export default { listNotifications, markRead, clearAll };
