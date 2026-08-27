import catchAsync from "../utils/catchAsync.js";
import * as meService from "../services/meService.js";

export const getMe = catchAsync(async (req, res) => {
  const result = await meService.getMe(req.user);
  res.json(result);
});

export default { getMe };
