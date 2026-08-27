import jwt from "jsonwebtoken";
import cookie from "cookie";
import { Server } from "socket.io";
import config from "../config/config.js";
import { User } from "../models/index.js";
import logger from "../config/logger.js";
import { verifyRefreshToken } from "../utils/jwt.js";

let io = null;
/** @type {Map<number, { count: number, name: string }>} */
const onlineUsers = new Map();

function adminRoles() {
  return ["ADMIN", "CEO"];
}

function isAdminRole(role) {
  return adminRoles().includes(role);
}

async function userCanAccessConversation(user, conversationId) {
  const cid = Number(conversationId);
  if (!cid) return false;
  const { ChatConversation, ChatGroupMember } = await import("../models/index.js");
  const conv = await ChatConversation.findByPk(cid);
  if (!conv) return false;
  if (conv.kind === "group") {
    const row = await ChatGroupMember.findOne({
      where: { conversation_id: cid, user_id: user.id },
    });
    return Boolean(row);
  }
  if (conv.user_one_id && conv.user_two_id) {
    return conv.user_one_id === user.id || conv.user_two_id === user.id;
  }
  if (isAdminRole(user.role) && conv.member_user_id && !conv.user_one_id) return true;
  return conv.member_user_id === user.id;
}

function buildPresencePayload() {
  const onlineUserList = [...onlineUsers.entries()]
    .filter(([, entry]) => entry.count > 0)
    .map(([userId, entry]) => ({ id: Number(userId), name: entry.name }));
  return {
    onlineCount: onlineUserList.length,
    onlineUsers: onlineUserList.map((u) => u.id),
    onlineUserList,
  };
}

function broadcastPresence() {
  if (!io) return;
  const payload = buildPresencePayload();
  io.emit("presence:update", payload);
}

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    path: "/api/socket.io",
  });

  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie || "";
      const cookies = cookie.parse(raw);
      let userId = null;

      if (cookies.accessToken) {
        try {
          const payload = jwt.verify(cookies.accessToken, config.jwt.secret);
          userId = payload?.userId ?? payload?.user_id;
        } catch {
          userId = null;
        }
      }

      if (!userId && cookies.refreshToken) {
        try {
          const payload = verifyRefreshToken(cookies.refreshToken);
          userId = payload?.userId;
        } catch {
          userId = null;
        }
      }

      if (!userId) return next(new Error("Unauthorized"));

      const user = await User.findOne({
        where: { id: userId, is_active: true },
        attributes: ["id", "name", "email", "role", "team_id"],
      });
      if (!user) return next(new Error("Unauthorized"));

      socket.user = user.get({ plain: true });
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);
    if (isAdminRole(user.role)) socket.join("admins");

    const prev = onlineUsers.get(user.id)?.count || 0;
    onlineUsers.set(user.id, { count: prev + 1, name: user.name });
    broadcastPresence();

    socket.emit("presence:update", buildPresencePayload());

    socket.on("disconnect", () => {
      const entry = onlineUsers.get(user.id);
      if (!entry || entry.count <= 1) onlineUsers.delete(user.id);
      else onlineUsers.set(user.id, { count: entry.count - 1, name: entry.name });
      broadcastPresence();
    });

    socket.on("chat:join", async ({ conversationId }) => {
      const cid = Number(conversationId);
      if (!cid || !(await userCanAccessConversation(user, cid))) return;
      socket.join(`conv:${cid}`);
    });

    socket.on("chat:leave", ({ conversationId }) => {
      const cid = Number(conversationId);
      if (!cid) return;
      socket.leave(`conv:${cid}`);
    });

    socket.on("chat:typing", ({ conversationId, typing }) => {
      const cid = Number(conversationId);
      if (!cid) return;
      const room = `conv:${cid}`;
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit("chat:typing", {
        conversationId: cid,
        userId: user.id,
        userName: user.name,
        typing: Boolean(typing),
      });
    });
  });

  logger.info("Socket.IO initialized");
  return io;
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToUsers(userIds, event, payload) {
  if (!io) return;
  const seen = new Set();
  for (const id of userIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    emitToUser(id, event, payload);
  }
}

export function emitToAdmins(event, payload) {
  if (!io) return;
  io.to("admins").emit(event, payload);
}

export function emitChatUpdate(participantUserIds, payload) {
  if (!io) return;
  const ids = (Array.isArray(participantUserIds) ? participantUserIds : [participantUserIds]).filter(Boolean);
  emitToUsers([...new Set(ids)], "chat:update", payload);
}

export function emitNotificationsFromRows(rows) {
  if (!rows?.length) return;

  for (const row of rows) {
    const plain = row.get ? row.get({ plain: true }) : row;
    emitToUser(plain.user_id, "notification:new", {
      notification: {
        id: plain.id,
        user_id: plain.user_id,
        type: plain.type,
        title: plain.title,
        body: plain.body,
        task_id: plain.task_id,
        created_at: plain.created_at,
        read_at: plain.read_at ?? null,
      },
    });
  }

  const sample = rows[0].get ? rows[0].get({ plain: true }) : rows[0];
  emitToAdmins("admin:notification", {
    notifications: rows.map((r) => {
      const p = r.get ? r.get({ plain: true }) : r;
      return {
        id: p.id,
        user_id: p.user_id,
        type: p.type,
        title: p.title,
        body: p.body,
        task_id: p.task_id,
        created_at: p.created_at,
      };
    }),
    type: sample.type,
    title: sample.title,
    body: sample.body,
    task_id: sample.task_id,
    created_at: sample.created_at,
  });
}

export async function emitTaskChanged({ action, task, actor, taskIds = [] }) {
  if (!io || !task) return;

  const payload = {
    action,
    taskId: task.id,
    taskIds: taskIds.length ? taskIds : [task.id],
    status: task.status,
    assigneeId: task.assignee_id,
    creatorId: task.creator_id,
    title: task.title,
    actorId: actor?.id,
    actorName: actor?.name,
  };

  const recipients = new Set([task.assignee_id, task.creator_id].filter(Boolean));
  emitToUsers([...recipients], "task:changed", payload);
  emitToAdmins("task:changed", payload);
}

export async function emitTasksCreated({ taskIds, actor, primaryTask }) {
  if (!io || !taskIds?.length) return;
  const payload = {
    action: "created",
    taskId: primaryTask?.id ?? taskIds[0],
    taskIds,
    status: primaryTask?.status,
    assigneeId: primaryTask?.assignee_id,
    creatorId: primaryTask?.creator_id ?? actor?.id,
    title: primaryTask?.title,
    actorId: actor?.id,
    actorName: actor?.name,
  };

  const recipients = new Set([primaryTask?.assignee_id, primaryTask?.creator_id, actor?.id].filter(Boolean));
  emitToUsers([...recipients], "task:changed", payload);
  emitToAdmins("task:changed", payload);
}

export default {
  initSocket,
  emitToUser,
  emitToUsers,
  emitToAdmins,
  emitChatUpdate,
  emitNotificationsFromRows,
  emitTaskChanged,
  emitTasksCreated,
};
