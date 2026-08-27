import httpStatus from "http-status";
import { QueryTypes } from "sequelize";
import {
  sequelize,
  User,
  ChatConversation,
  ChatMessage,
  ChatMessageReaction,
  ChatGroupMember,
} from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { emitChatUpdate } from "../lib/socket.js";
import {
  deleteAttachmentsForMessage,
  linkAttachmentsToMessage,
  loadAttachmentsForMessages,
} from "./uploadsService.js";

const now = () => Date.now();
const isBoss = (user) => ["ADMIN", "CEO"].includes(user.role);

function pairUserIds(userIdA, userIdB) {
  const a = Number(userIdA);
  const b = Number(userIdB);
  return a < b ? { userOneId: a, userTwoId: b } : { userOneId: b, userTwoId: a };
}

async function getGroupMemberIds(conversationId) {
  const rows = await ChatGroupMember.findAll({
    where: { conversation_id: conversationId },
    attributes: ["user_id"],
  });
  return rows.map((r) => r.user_id);
}

async function getParticipantUserIds(conv) {
  if (conv.kind === "group") return getGroupMemberIds(conv.id);
  if (conv.user_one_id && conv.user_two_id) return [conv.user_one_id, conv.user_two_id];
  if (conv.member_user_id) return [conv.member_user_id];
  return [];
}

async function isGroupMember(conversationId, userId) {
  const row = await ChatGroupMember.findOne({
    where: { conversation_id: conversationId, user_id: userId },
  });
  return Boolean(row);
}

async function isParticipant(conv, userId) {
  if (conv.kind === "group") return isGroupMember(conv.id, userId);
  if (conv.user_one_id && conv.user_two_id) {
    return conv.user_one_id === userId || conv.user_two_id === userId;
  }
  return conv.member_user_id === userId;
}

const LAST_MESSAGE_PREVIEW_SQL = `(
  SELECT CASE
           WHEN m.deleted_at IS NOT NULL THEN '[Message deleted]'
           WHEN COALESCE(m.body, '') <> '' THEN LEFT(m.body, 120)
           WHEN EXISTS (SELECT 1 FROM attachments a WHERE a.chat_message_id = m.id) THEN '[Attachment]'
           ELSE LEFT(m.body, 120)
         END
  FROM chat_messages m
  WHERE m.conversation_id = c.id
  ORDER BY m.created_at DESC, m.id DESC
  LIMIT 1
) AS last_message_preview`;

const GROUP_MEMBER_NAMES_EXPR = `(
  SELECT STRING_AGG(u.name, ', ' ORDER BY u.name)
  FROM chat_group_members gm
  JOIN users u ON u.id = gm.user_id AND u.is_active = true
  WHERE gm.conversation_id = c.id
)`;

const GROUP_MEMBER_LIST_EXPR = `(
  SELECT COALESCE(
    JSON_AGG(JSON_BUILD_OBJECT('id', u.id, 'name', u.name) ORDER BY u.name),
    '[]'::json
  )
  FROM chat_group_members gm
  JOIN users u ON u.id = gm.user_id AND u.is_active = true
  WHERE gm.conversation_id = c.id
)`;

const PEER_JOIN_SQL = `LEFT JOIN users peer ON peer.id = CASE
  WHEN c.kind = 'group' THEN NULL
  WHEN c.user_one_id IS NOT NULL AND c.user_two_id IS NOT NULL THEN
    CASE WHEN c.user_one_id = :viewerId THEN c.user_two_id ELSE c.user_one_id END
  ELSE c.member_user_id
END`;

async function loadMessagesWithReactions(conversationId, viewerId) {
  const messages = await sequelize.query(
    `SELECT m.id, m.conversation_id, m.author_id, m.parent_message_id, m.body,
            m.edited, m.edited_at, m.deleted_at, m.created_at, m.updated_at,
            u.name AS author_name
     FROM chat_messages m
     JOIN users u ON u.id = m.author_id
     WHERE m.conversation_id = :conversationId
     ORDER BY m.created_at ASC, m.id ASC`,
    { replacements: { conversationId }, type: QueryTypes.SELECT }
  );

  if (!messages.length) return [];

  const reactionRows = await sequelize.query(
    `SELECT message_id, emoji, COUNT(*)::int AS count,
            BOOL_OR(user_id = :viewerId) AS mine
     FROM chat_message_reactions
     WHERE message_id IN (SELECT id FROM chat_messages WHERE conversation_id = :conversationId)
     GROUP BY message_id, emoji`,
    { replacements: { conversationId, viewerId }, type: QueryTypes.SELECT }
  );

  const reactionsByMessage = {};
  for (const r of reactionRows) {
    if (!reactionsByMessage[r.message_id]) reactionsByMessage[r.message_id] = [];
    reactionsByMessage[r.message_id].push({
      emoji: r.emoji,
      count: r.count,
      mine: r.mine,
    });
  }

  const messageIds = messages.map((m) => m.id);
  const attachmentsByMessage = await loadAttachmentsForMessages(messageIds);

  return messages.map((m) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    author_id: m.author_id,
    author_name: m.author_name,
    parent_message_id: m.parent_message_id,
    body: m.deleted_at ? null : m.body,
    edited: m.edited,
    edited_at: m.edited_at,
    deleted_at: m.deleted_at,
    created_at: m.created_at,
    updated_at: m.updated_at,
    reactions: reactionsByMessage[m.id] || [],
    attachments: m.deleted_at ? [] : attachmentsByMessage[m.id] || [],
  }));
}

function parseMemberList(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function formatConversationRow(row) {
  const isGroup = row.kind === "group";
  return {
    id: row.id,
    kind: row.kind || "direct",
    name: row.group_name || row.name || null,
    member_user_id: isGroup ? null : row.member_user_id,
    member_name: isGroup ? row.group_name || row.name : row.member_name,
    member_email: isGroup ? null : row.member_email,
    member_role: isGroup ? "GROUP" : row.member_role,
    member_count: row.member_count != null ? Number(row.member_count) : null,
    member_names: isGroup ? row.member_names || null : null,
    member_list: isGroup ? parseMemberList(row.member_list) : null,
    last_message_at: row.last_message_at,
    last_message_preview: row.last_message_preview,
    created_at: row.created_at,
  };
}

async function getConversationRow(conversationId, viewerId) {
  const [row] = await sequelize.query(
    `SELECT c.id, c.kind, c.name AS group_name, c.last_message_at, c.created_at,
            peer.id AS member_user_id,
            CASE WHEN c.kind = 'group' THEN c.name ELSE peer.name END AS member_name,
            peer.email AS member_email,
            peer.role AS member_role,
            (SELECT COUNT(*)::int FROM chat_group_members gm WHERE gm.conversation_id = c.id) AS member_count,
            ${GROUP_MEMBER_NAMES_EXPR} AS member_names,
            ${GROUP_MEMBER_LIST_EXPR} AS member_list,
            ${LAST_MESSAGE_PREVIEW_SQL}
     FROM chat_conversations c
     ${PEER_JOIN_SQL}
     WHERE c.id = :conversationId`,
    { replacements: { conversationId, viewerId }, type: QueryTypes.SELECT }
  );
  return row ? formatConversationRow(row) : null;
}

async function assertCanAccessConversation(user, conversationId) {
  const conv = await ChatConversation.findByPk(conversationId);
  if (!conv) throw new ApiError(httpStatus.NOT_FOUND, "Conversation not found");
  if (await isParticipant(conv, user.id)) return conv;
  if (isBoss(user) && conv.member_user_id && !conv.user_one_id && conv.kind !== "group") return conv;
  throw new ApiError(httpStatus.FORBIDDEN, "You cannot access this conversation");
}

async function findOrCreateDirectConversation(userId, otherUserId) {
  if (userId === otherUserId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You cannot chat with yourself");
  }
  const { userOneId, userTwoId } = pairUserIds(userId, otherUserId);
  let conv = await ChatConversation.findOne({
    where: { kind: "direct", user_one_id: userOneId, user_two_id: userTwoId },
  });
  if (!conv) {
    const t = now();
    conv = await ChatConversation.create({
      kind: "direct",
      user_one_id: userOneId,
      user_two_id: userTwoId,
      member_user_id: null,
      last_message_at: t,
      created_at: t,
    });
  }
  return conv;
}

async function validateActiveUserIds(ids) {
  const unique = [...new Set(ids.map(Number).filter(Boolean))];
  if (!unique.length) return [];
  const rows = await User.findAll({
    where: { id: unique, is_active: true },
    attributes: ["id"],
  });
  if (rows.length !== unique.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, "One or more users are invalid");
  }
  return unique;
}

async function replaceGroupMembers(conversationId, memberIds, addedBy) {
  const ids = await validateActiveUserIds(memberIds);
  if (!ids.length) throw new ApiError(httpStatus.BAD_REQUEST, "Add at least one member");

  await ChatGroupMember.destroy({ where: { conversation_id: conversationId } });
  const t = now();
  await ChatGroupMember.bulkCreate(
    ids.map((userId) => ({
      conversation_id: conversationId,
      user_id: userId,
      added_by: addedBy,
      created_at: t,
    }))
  );
  return ids;
}

export async function listChatTargets(user) {
  const rows = await sequelize.query(
    `SELECT u.id, u.name, u.email, u.role, u.team_id, t.name AS team_name,
            c.id AS conversation_id, c.last_message_at
     FROM users u
     LEFT JOIN teams t ON t.id = u.team_id
     LEFT JOIN chat_conversations c ON (
       c.kind = 'direct'
       AND (
         (c.user_one_id = u.id AND c.user_two_id = :myId)
         OR (c.user_two_id = u.id AND c.user_one_id = :myId)
       )
     )
     WHERE u.is_active = true
       AND u.id != :myId
     ORDER BY COALESCE(c.last_message_at, 0) DESC, u.name ASC`,
    { replacements: { myId: user.id }, type: QueryTypes.SELECT }
  );
  return {
    targets: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      team_name: r.team_name,
      conversation_id: r.conversation_id,
      last_message_at: r.last_message_at,
    })),
  };
}

export async function listConversations(user) {
  const rows = await sequelize.query(
    `SELECT c.id, c.kind, c.name AS group_name, c.last_message_at, c.created_at,
            peer.id AS member_user_id,
            CASE WHEN c.kind = 'group' THEN c.name ELSE peer.name END AS member_name,
            peer.email AS member_email,
            peer.role AS member_role,
            (SELECT COUNT(*)::int FROM chat_group_members gm WHERE gm.conversation_id = c.id) AS member_count,
            ${GROUP_MEMBER_NAMES_EXPR} AS member_names,
            ${GROUP_MEMBER_LIST_EXPR} AS member_list,
            ${LAST_MESSAGE_PREVIEW_SQL}
     FROM chat_conversations c
     ${PEER_JOIN_SQL}
     LEFT JOIN chat_group_members gm ON gm.conversation_id = c.id AND gm.user_id = :viewerId
     WHERE (
       (c.kind = 'direct' AND (c.user_one_id = :viewerId OR c.user_two_id = :viewerId))
       OR (c.member_user_id = :viewerId AND c.user_one_id IS NULL AND c.kind = 'direct')
       OR (c.kind = 'group' AND gm.user_id IS NOT NULL)
     )
     ORDER BY c.last_message_at DESC`,
    { replacements: { viewerId: user.id }, type: QueryTypes.SELECT }
  );
  return { conversations: rows.map(formatConversationRow) };
}

export async function listGroups(user) {
  const rows = await sequelize.query(
    `SELECT c.id, c.kind, c.name AS group_name, c.last_message_at, c.created_at,
            c.name AS member_name,
            (SELECT COUNT(*)::int FROM chat_group_members gm WHERE gm.conversation_id = c.id) AS member_count,
            ${GROUP_MEMBER_NAMES_EXPR} AS member_names,
            ${GROUP_MEMBER_LIST_EXPR} AS member_list,
            ${LAST_MESSAGE_PREVIEW_SQL}
     FROM chat_conversations c
     JOIN chat_group_members gm ON gm.conversation_id = c.id AND gm.user_id = :viewerId
     WHERE c.kind = 'group'
     ORDER BY c.last_message_at DESC`,
    { replacements: { viewerId: user.id }, type: QueryTypes.SELECT }
  );
  return {
    groups: rows.map((row) =>
      formatConversationRow({
        ...row,
        kind: "group",
        member_user_id: null,
        member_email: null,
        member_role: "GROUP",
      })
    ),
  };
}

export async function getGroupDetail(user, groupId) {
  const conv = await assertCanAccessConversation(user, groupId);
  if (conv.kind !== "group") throw new ApiError(httpStatus.BAD_REQUEST, "Not a group conversation");

  const members = await sequelize.query(
    `SELECT u.id, u.name, u.email, u.role, t.name AS team_name
     FROM chat_group_members gm
     JOIN users u ON u.id = gm.user_id
     LEFT JOIN teams t ON t.id = u.team_id
     WHERE gm.conversation_id = :groupId
     ORDER BY u.name ASC`,
    { replacements: { groupId }, type: QueryTypes.SELECT }
  );

  return {
    group: await getConversationRow(groupId, user.id),
    members,
    canManage: isBoss(user),
  };
}

export async function createGroup(user, { name, memberIds = [] }) {
  if (!isBoss(user)) throw new ApiError(httpStatus.FORBIDDEN, "Only Admin or CEO can create groups");
  const title = String(name || "").trim();
  if (!title) throw new ApiError(httpStatus.BAD_REQUEST, "Group name is required");

  const t = now();
  const conv = await ChatConversation.create({
    kind: "group",
    name: title,
    created_by: user.id,
    user_one_id: null,
    user_two_id: null,
    member_user_id: null,
    last_message_at: t,
    created_at: t,
  });

  const ids = await validateActiveUserIds(memberIds);
  const finalIds = [...new Set([...ids, user.id])];
  await replaceGroupMembers(conv.id, finalIds, user.id);

  const group = await getConversationRow(conv.id, user.id);
  const participantIds = await getParticipantUserIds(conv);
  emitChatUpdate(participantIds, { action: "group", conversation: group });

  return { group, memberIds: finalIds };
}

export async function updateGroup(user, groupId, { name, memberIds }) {
  if (!isBoss(user)) throw new ApiError(httpStatus.FORBIDDEN, "Only Admin or CEO can update groups");
  const conv = await ChatConversation.findByPk(groupId);
  if (!conv || conv.kind !== "group") throw new ApiError(httpStatus.NOT_FOUND, "Group not found");

  if (name != null) {
    const title = String(name).trim();
    if (!title) throw new ApiError(httpStatus.BAD_REQUEST, "Group name is required");
    await conv.update({ name: title });
  }

  let finalIds = null;
  if (Array.isArray(memberIds)) {
    const withCreator = [...new Set([...memberIds.map(Number).filter(Boolean), user.id])];
    finalIds = await replaceGroupMembers(groupId, withCreator, user.id);
  }

  const group = await getConversationRow(groupId, user.id);
  const participantIds = finalIds || (await getParticipantUserIds(conv));
  emitChatUpdate(participantIds, { action: "group", conversation: group });

  return { group, memberIds: finalIds || (await getGroupMemberIds(groupId)) };
}

export async function openConversation(user, otherUserId) {
  if (!otherUserId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Choose a user to chat with");
  }

  const target = await User.findOne({
    where: { id: otherUserId, is_active: true },
    attributes: ["id", "name", "role"],
  });
  if (!target) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  if (target.id === user.id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You cannot chat with yourself");
  }

  const conv = await findOrCreateDirectConversation(user.id, target.id);
  const row = await getConversationRow(conv.id, user.id);
  const messages = await loadMessagesWithReactions(conv.id, user.id);
  return { conversation: row, messages };
}

export async function openGroup(user, groupId) {
  const conv = await assertCanAccessConversation(user, groupId);
  if (conv.kind !== "group") throw new ApiError(httpStatus.BAD_REQUEST, "Not a group conversation");
  const row = await getConversationRow(conv.id, user.id);
  const messages = await loadMessagesWithReactions(conv.id, user.id);
  return { conversation: row, messages };
}

export async function getMessages(user, conversationId) {
  const conv = await assertCanAccessConversation(user, conversationId);
  const row = await getConversationRow(conv.id, user.id);
  const messages = await loadMessagesWithReactions(conv.id, user.id);
  return { conversation: row, messages };
}

export async function sendMessage(user, conversationId, { body, parentMessageId, attachmentIds = [] }) {
  const conv = await assertCanAccessConversation(user, conversationId);
  const text = String(body || "").trim();
  const ids = Array.isArray(attachmentIds) ? attachmentIds.map(Number).filter(Boolean) : [];
  if (!text && !ids.length) throw new ApiError(httpStatus.BAD_REQUEST, "Message or attachment is required");

  if (parentMessageId) {
    const parent = await ChatMessage.findOne({
      where: { id: parentMessageId, conversation_id: conversationId, deleted_at: null },
    });
    if (!parent) throw new ApiError(httpStatus.BAD_REQUEST, "Reply target not found");
  }

  const t = now();
  const message = await ChatMessage.create({
    conversation_id: conversationId,
    author_id: user.id,
    parent_message_id: parentMessageId || null,
    body: text || null,
    edited: false,
    created_at: t,
    updated_at: t,
  });

  if (ids.length) {
    await linkAttachmentsToMessage(message.id, ids, user.id);
  }

  await conv.update({ last_message_at: t });

  const messages = await loadMessagesWithReactions(conversationId, user.id);
  const created = messages.find((m) => m.id === message.id);
  const conversation = await getConversationRow(conversationId, user.id);
  const participantIds = await getParticipantUserIds(conv);
  emitChatUpdate(participantIds, { action: "message", conversation, message: created });
  return { message: created, conversation };
}

export async function editMessage(user, messageId, body) {
  const text = String(body || "").trim();
  if (!text) throw new ApiError(httpStatus.BAD_REQUEST, "Message is required");

  const message = await ChatMessage.findByPk(messageId);
  if (!message) throw new ApiError(httpStatus.NOT_FOUND, "Message not found");
  if (message.deleted_at) throw new ApiError(httpStatus.BAD_REQUEST, "Cannot edit a deleted message");
  if (message.author_id !== user.id && !isBoss(user)) {
    throw new ApiError(httpStatus.FORBIDDEN, "You can only edit your own messages");
  }

  await assertCanAccessConversation(user, message.conversation_id);

  const t = now();
  await message.update({ body: text, edited: true, edited_at: t, updated_at: t });

  const conv = await ChatConversation.findByPk(message.conversation_id);
  const messages = await loadMessagesWithReactions(message.conversation_id, user.id);
  const updated = messages.find((m) => m.id === message.id);
  const conversation = await getConversationRow(message.conversation_id, user.id);
  const participantIds = await getParticipantUserIds(conv);
  emitChatUpdate(participantIds, { action: "message", conversation, message: updated });
  return { message: updated, conversation };
}

export async function deleteMessage(user, messageId) {
  const message = await ChatMessage.findByPk(messageId);
  if (!message) throw new ApiError(httpStatus.NOT_FOUND, "Message not found");
  if (message.deleted_at) return { message: { id: message.id, deleted_at: message.deleted_at } };

  if (message.author_id !== user.id && !isBoss(user)) {
    throw new ApiError(httpStatus.FORBIDDEN, "You can only delete your own messages");
  }

  await assertCanAccessConversation(user, message.conversation_id);

  await deleteAttachmentsForMessage(message.id);

  const t = now();
  await message.update({ deleted_at: t, updated_at: t, body: null });

  const conv = await ChatConversation.findByPk(message.conversation_id);
  const messages = await loadMessagesWithReactions(message.conversation_id, user.id);
  const updated = messages.find((m) => m.id === message.id);
  const conversation = await getConversationRow(message.conversation_id, user.id);
  const participantIds = await getParticipantUserIds(conv);
  emitChatUpdate(participantIds, { action: "message", conversation, message: updated });
  return { message: updated, conversation };
}

export async function toggleReaction(user, messageId, emoji) {
  const reactionEmoji = String(emoji || "").trim();
  if (!reactionEmoji) throw new ApiError(httpStatus.BAD_REQUEST, "Emoji is required");

  const message = await ChatMessage.findByPk(messageId);
  if (!message) throw new ApiError(httpStatus.NOT_FOUND, "Message not found");
  if (message.deleted_at) throw new ApiError(httpStatus.BAD_REQUEST, "Cannot react to a deleted message");

  await assertCanAccessConversation(user, message.conversation_id);

  const existing = await ChatMessageReaction.findOne({
    where: { message_id: messageId, user_id: user.id, emoji: reactionEmoji },
  });

  if (existing) await existing.destroy();
  else {
    await ChatMessageReaction.create({
      message_id: messageId,
      user_id: user.id,
      emoji: reactionEmoji,
      created_at: now(),
    });
  }

  const conv = await ChatConversation.findByPk(message.conversation_id);
  const messages = await loadMessagesWithReactions(message.conversation_id, user.id);
  const updated = messages.find((m) => m.id === message.id);
  const conversation = await getConversationRow(message.conversation_id, user.id);
  const participantIds = await getParticipantUserIds(conv);
  emitChatUpdate(participantIds, { action: "reaction", conversation, message: updated });
  return { message: updated, conversation };
}

export default {
  listChatTargets,
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
