import catchAsync from "../utils/catchAsync.js";
import * as uploadsService from "../services/uploadsService.js";

export const uploadFile = catchAsync(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "file field required" });
  }
  const projectId = req.body.projectId ? Number(req.body.projectId) : null;
  res.json(await uploadsService.createAttachment(req.user, req.file, projectId));
});

export const getFile = catchAsync(async (req, res) => {
  const att = await uploadsService.getAttachment(Number(req.params.id));
  uploadsService.streamAttachment(att, res);
});

export const deleteFile = catchAsync(async (req, res) => {
  res.json(await uploadsService.deleteAttachmentById(req.user, Number(req.params.id)));
});

export default { uploadFile, getFile, deleteFile };
