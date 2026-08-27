import catchAsync from "../utils/catchAsync.js";
import * as chatService from "../services/chatService.js";

export const listTargets = catchAsync(async (req, res) => {
  res.json(await chatService.listChatTargets(req.user));
});

export const listConversations = catchAsync(async (req, res) => {
  res.json(await chatService.listConversations(req.user));
});

export const listGroups = catchAsync(async (req, res) => {
  res.json(await chatService.listGroups(req.user));
});

export const getGroupDetail = catchAsync(async (req, res) => {
  res.json(await chatService.getGroupDetail(req.user, Number(req.params.id)));
});

export const createGroup = catchAsync(async (req, res) => {
  res.json(
    await chatService.createGroup(req.user, {
      name: req.body.name,
      memberIds: req.body.memberIds,
    })
  );
});

export const updateGroup = catchAsync(async (req, res) => {
  res.json(
    await chatService.updateGroup(req.user, Number(req.params.id), {
      name: req.body.name,
      memberIds: req.body.memberIds,
    })
  );
});

export const openConversation = catchAsync(async (req, res) => {
  const memberUserId = req.body?.userId ?? req.query?.userId;
  res.json(await chatService.openConversation(req.user, memberUserId ? Number(memberUserId) : null));
});

export const openGroup = catchAsync(async (req, res) => {
  res.json(await chatService.openGroup(req.user, Number(req.params.id)));
});

export const getMessages = catchAsync(async (req, res) => {
  res.json(await chatService.getMessages(req.user, Number(req.params.id)));
});

export const sendMessage = catchAsync(async (req, res) => {
  res.json(
    await chatService.sendMessage(req.user, Number(req.params.id), {
      body: req.body.body,
      parentMessageId: req.body.parentMessageId ? Number(req.body.parentMessageId) : null,
      attachmentIds: req.body.attachmentIds,
    })
  );
});

export const editMessage = catchAsync(async (req, res) => {
  res.json(await chatService.editMessage(req.user, Number(req.params.messageId), req.body.body));
});

export const deleteMessage = catchAsync(async (req, res) => {
  res.json(await chatService.deleteMessage(req.user, Number(req.params.messageId)));
});

export const toggleReaction = catchAsync(async (req, res) => {
  res.json(await chatService.toggleReaction(req.user, Number(req.params.messageId), req.body.emoji));
});

export default {
  listTargets,
  listConversations,
  listGroups,
  getGroupDetail,
  createGroup,
  updateGroup,
  openConversation,
  openGroup,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
};
