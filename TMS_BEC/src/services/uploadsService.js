import fs from "fs";
import httpStatus from "http-status";
import { Op } from "sequelize";
import { Attachment, ChatMessage, Task } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { now } from "../lib/time.js";

export function formatAttachmentRow(row) {
  return {
    id: row.id,
    file_name: row.file_name,
    mime_type: row.mime_type,
    size: row.size,
    context: row.context || "file",
    uploader_id: row.uploader_id,
    created_at: row.created_at,
  };
}

export function unlinkFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore missing or locked files
  }
}

export async function deleteAttachmentRecord(att) {
  if (!att) return;
  unlinkFile(att.file_path);
  await att.destroy();
}

export async function deleteAttachmentsByIds(ids = []) {
  if (!ids.length) return;
  const rows = await Attachment.findAll({ where: { id: ids } });
  for (const row of rows) {
    await deleteAttachmentRecord(row);
  }
}

const isBoss = (user) => ["ADMIN", "CEO"].includes(user?.role);

async function canDeleteAttachment(user, att) {
  if (!att) return false;
  if (isBoss(user)) return true;
  if (att.uploader_id === user.id) return true;

  if (att.task_id) {
    const task = await Task.findByPk(att.task_id, { attributes: ["creator_id"] });
    if (task?.creator_id === user.id) return true;
  }

  if (att.chat_message_id) {
    const message = await ChatMessage.findByPk(att.chat_message_id, {
      attributes: ["author_id", "conversation_id"],
    });
    if (message?.author_id === user.id) return true;
  }

  // Unlinked uploads (e.g. pending voice notes in chat/composer) — uploader only (handled above)
  if (!att.task_id && !att.chat_message_id && !att.project_id && !att.comment_id) {
    return att.uploader_id === user.id;
  }

  return false;
}

export async function deleteAttachmentById(user, attachmentId) {
  const att = await Attachment.findByPk(attachmentId);
  if (!att) throw new ApiError(httpStatus.NOT_FOUND, "Attachment not found");
  if (!(await canDeleteAttachment(user, att))) {
    throw new ApiError(httpStatus.FORBIDDEN, "You cannot delete this attachment");
  }
  await deleteAttachmentRecord(att);
  return { ok: true, id: attachmentId };
}

export async function deleteAttachmentsForMessage(messageId) {
  const rows = await Attachment.findAll({ where: { chat_message_id: messageId } });
  const ids = rows.map((r) => r.id);
  await deleteAttachmentsByIds(ids);
  return ids;
}

async function assertOwnUnlinkedAttachments(attachmentIds, userId) {
  const unique = [...new Set(attachmentIds.map(Number).filter(Boolean))];
  if (!unique.length) return [];

  const rows = await Attachment.findAll({ where: { id: unique, uploader_id: userId } });
  if (rows.length !== unique.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, "One or more attachments are invalid");
  }

  for (const row of rows) {
    if (row.task_id || row.project_id || row.comment_id || row.chat_message_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Attachment is already linked");
    }
  }

  return unique;
}

export async function linkAttachmentsToMessage(messageId, attachmentIds, userId) {
  const ids = await assertOwnUnlinkedAttachments(attachmentIds, userId);
  if (!ids.length) return [];

  await Attachment.update(
    { chat_message_id: messageId, context: "chat" },
    { where: { id: ids, uploader_id: userId } }
  );
  return ids;
}

export async function linkAttachmentsToTask(taskId, attachmentIds, userId, context = "file") {
  const ids = await assertOwnUnlinkedAttachments(attachmentIds, userId);
  if (!ids.length) return [];

  await Attachment.update(
    { task_id: taskId, context },
    { where: { id: ids, uploader_id: userId } }
  );
  return ids;
}

export async function loadAttachmentsForMessages(messageIds) {
  if (!messageIds.length) return {};
  const rows = await Attachment.findAll({
    where: { chat_message_id: { [Op.in]: messageIds } },
    order: [["created_at", "ASC"], ["id", "ASC"]],
  });
  const byMessage = {};
  for (const row of rows) {
    if (!byMessage[row.chat_message_id]) byMessage[row.chat_message_id] = [];
    byMessage[row.chat_message_id].push(formatAttachmentRow(row));
  }
  return byMessage;
}

export const getAttachment = async (attachmentId) => {
  const att = await Attachment.findByPk(attachmentId);
  if (!att) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  return att;
};

export const createAttachment = async (user, file, projectId = null) => {
  const att = await Attachment.create({
    uploader_id: user.id,
    file_name: file.originalname || "file",
    mime_type: file.mimetype || "application/octet-stream",
    size: file.size,
    file_path: file.path,
    project_id: projectId,
    context: projectId ? "file" : "file",
    created_at: now(),
  });

  return {
    id: att.id,
    fileName: att.file_name,
    mimeType: att.mime_type,
    size: att.size,
  };
};

export const streamAttachment = (att, res) => {
  if (!fs.existsSync(att.file_path)) {
    throw new ApiError(httpStatus.NOT_FOUND, "File not found on disk");
  }

  res.set({
    "Content-Type": att.mime_type,
    "Content-Disposition": `inline; filename="${encodeURIComponent(att.file_name)}"`,
    "Cache-Control": "private, max-age=3600",
  });

  fs.createReadStream(att.file_path).pipe(res);
};

export default {
  formatAttachmentRow,
  unlinkFile,
  deleteAttachmentRecord,
  deleteAttachmentsByIds,
  deleteAttachmentById,
  deleteAttachmentsForMessage,
  linkAttachmentsToMessage,
  linkAttachmentsToTask,
  loadAttachmentsForMessages,
  getAttachment,
  createAttachment,
  streamAttachment,
};
