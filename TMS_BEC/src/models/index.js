import sequelize from "../config/db.js";
import User from "./User.js";
import Team from "./Team.js";
import Task from "./Task.js";
import Comment from "./Comment.js";
import CommentReaction from "./CommentReaction.js";
import Activity from "./Activity.js";
import Escalation from "./Escalation.js";
import Project from "./Project.js";
import ProjectMember from "./ProjectMember.js";
import ProjectNote from "./ProjectNote.js";
import Notification from "./Notification.js";
import Attachment from "./Attachment.js";
import Board from "./Board.js";
import TaskType from "./TaskType.js";
import Meta from "./Meta.js";
import Otp from "./Otp.js";
import TaskMember from "./TaskMember.js";
import ChatConversation from "./ChatConversation.js";
import ChatMessage from "./ChatMessage.js";
import ChatMessageReaction from "./ChatMessageReaction.js";
import ChatGroupMember from "./ChatGroupMember.js";

// ── Users & Teams ──────────────────────────────────────────────────────────
// No DB-level FK between users ↔ teams (circular: team_id + manager_id); enforce in app layer.
User.belongsTo(Team, { foreignKey: "team_id", as: "team", constraints: false });
Team.hasMany(User, { foreignKey: "team_id", as: "members", constraints: false });

Team.belongsTo(User, { foreignKey: "manager_id", as: "manager", constraints: false });
User.hasMany(Team, { foreignKey: "manager_id", as: "managedTeams" });

// ── Tasks ──────────────────────────────────────────────────────────────────
Task.belongsTo(User, { foreignKey: "creator_id", as: "creator" });
Task.belongsTo(User, { foreignKey: "assignee_id", as: "assignee" });
Task.belongsTo(Team, { foreignKey: "assigned_team_id", as: "assignedTeam" });
Task.belongsTo(Project, { foreignKey: "project_id", as: "project" });
Task.belongsTo(Task, { foreignKey: "parent_id", as: "parent" });
Task.hasMany(Task, { foreignKey: "parent_id", as: "children" });
Task.belongsTo(Board, { foreignKey: "board_id", as: "board" });
Task.belongsTo(TaskType, { foreignKey: "task_type_id", as: "taskType" });

User.hasMany(Task, { foreignKey: "creator_id", as: "createdTasks" });
User.hasMany(Task, { foreignKey: "assignee_id", as: "assignedTasks" });
Team.hasMany(Task, { foreignKey: "assigned_team_id", as: "tasks" });
Project.hasMany(Task, { foreignKey: "project_id", as: "tasks" });
Board.hasMany(Task, { foreignKey: "board_id", as: "tasks" });
TaskType.hasMany(Task, { foreignKey: "task_type_id", as: "tasks" });

TaskMember.belongsTo(Task, { foreignKey: "task_id", as: "task" });
TaskMember.belongsTo(User, { foreignKey: "user_id", as: "user" });
TaskMember.belongsTo(User, { foreignKey: "added_by", as: "addedBy", constraints: false });
Task.hasMany(TaskMember, { foreignKey: "task_id", as: "taskMembers" });
User.hasMany(TaskMember, { foreignKey: "user_id", as: "taskMemberships" });

// ── Comments & Reactions ───────────────────────────────────────────────────
Comment.belongsTo(Task, { foreignKey: "task_id", as: "task" });
Comment.belongsTo(User, { foreignKey: "author_id", as: "author" });
Comment.belongsTo(Comment, { foreignKey: "parent_comment_id", as: "parent" });
Comment.hasMany(Comment, { foreignKey: "parent_comment_id", as: "replies" });

Task.hasMany(Comment, { foreignKey: "task_id", as: "comments" });
User.hasMany(Comment, { foreignKey: "author_id", as: "comments" });

CommentReaction.belongsTo(Comment, { foreignKey: "comment_id", as: "comment" });
CommentReaction.belongsTo(User, { foreignKey: "user_id", as: "user" });
Comment.hasMany(CommentReaction, { foreignKey: "comment_id", as: "reactions" });
User.hasMany(CommentReaction, { foreignKey: "user_id", as: "commentReactions" });

// ── Activity ───────────────────────────────────────────────────────────────
Activity.belongsTo(Task, { foreignKey: "task_id", as: "task" });
Activity.belongsTo(User, { foreignKey: "actor_id", as: "actor" });
Task.hasMany(Activity, { foreignKey: "task_id", as: "activities" });
User.hasMany(Activity, { foreignKey: "actor_id", as: "activities" });

// ── Escalations ────────────────────────────────────────────────────────────
Escalation.belongsTo(Task, { foreignKey: "task_id", as: "task" });
Escalation.belongsTo(User, { foreignKey: "reviewer_id", as: "reviewer" });
Task.hasMany(Escalation, { foreignKey: "task_id", as: "escalations" });
User.hasMany(Escalation, { foreignKey: "reviewer_id", as: "reviewedEscalations" });

// ── Projects ───────────────────────────────────────────────────────────────
Project.belongsTo(User, { foreignKey: "owner_id", as: "owner" });
User.hasMany(Project, { foreignKey: "owner_id", as: "ownedProjects" });

ProjectMember.belongsTo(Project, { foreignKey: "project_id", as: "project" });
ProjectMember.belongsTo(User, { foreignKey: "user_id", as: "user" });
Project.hasMany(ProjectMember, { foreignKey: "project_id", as: "members" });
User.hasMany(ProjectMember, { foreignKey: "user_id", as: "projectMemberships" });

ProjectNote.belongsTo(Project, { foreignKey: "project_id", as: "project" });
ProjectNote.belongsTo(User, { foreignKey: "author_id", as: "author" });
Project.hasMany(ProjectNote, { foreignKey: "project_id", as: "notes" });
User.hasMany(ProjectNote, { foreignKey: "author_id", as: "projectNotes" });

// ── Notifications ──────────────────────────────────────────────────────────
Notification.belongsTo(User, { foreignKey: "user_id", as: "user" });
Notification.belongsTo(Task, { foreignKey: "task_id", as: "task" });
User.hasMany(Notification, { foreignKey: "user_id", as: "notifications" });
Task.hasMany(Notification, { foreignKey: "task_id", as: "notifications" });

// ── Attachments ────────────────────────────────────────────────────────────
Attachment.belongsTo(Task, { foreignKey: "task_id", as: "task" });
Attachment.belongsTo(Project, { foreignKey: "project_id", as: "project" });
Attachment.belongsTo(Comment, { foreignKey: "comment_id", as: "comment" });
Attachment.belongsTo(User, { foreignKey: "uploader_id", as: "uploader" });
Task.hasMany(Attachment, { foreignKey: "task_id", as: "attachments" });
Project.hasMany(Attachment, { foreignKey: "project_id", as: "attachments" });
Comment.hasMany(Attachment, { foreignKey: "comment_id", as: "attachments" });
User.hasMany(Attachment, { foreignKey: "uploader_id", as: "uploads" });

// ── Boards ─────────────────────────────────────────────────────────────────
Board.belongsTo(User, { foreignKey: "owner_id", as: "owner" });
User.hasMany(Board, { foreignKey: "owner_id", as: "boards" });

// ── Chat ───────────────────────────────────────────────────────────────────
ChatConversation.belongsTo(User, { foreignKey: "created_by", as: "creator" });
ChatGroupMember.belongsTo(ChatConversation, { foreignKey: "conversation_id", as: "conversation" });
ChatGroupMember.belongsTo(User, { foreignKey: "user_id", as: "user" });
ChatConversation.hasMany(ChatGroupMember, { foreignKey: "conversation_id", as: "groupMembers" });
User.hasMany(ChatGroupMember, { foreignKey: "user_id", as: "chatGroupMemberships" });

ChatMessage.belongsTo(ChatConversation, { foreignKey: "conversation_id", as: "conversation" });
ChatMessage.belongsTo(User, { foreignKey: "author_id", as: "author" });
ChatMessage.belongsTo(ChatMessage, { foreignKey: "parent_message_id", as: "parent" });
ChatMessage.hasMany(ChatMessage, { foreignKey: "parent_message_id", as: "replies" });
ChatConversation.hasMany(ChatMessage, { foreignKey: "conversation_id", as: "messages" });
User.hasMany(ChatMessage, { foreignKey: "author_id", as: "chatMessages" });

ChatMessageReaction.belongsTo(ChatMessage, { foreignKey: "message_id", as: "message" });
ChatMessageReaction.belongsTo(User, { foreignKey: "user_id", as: "user" });
ChatMessage.hasMany(ChatMessageReaction, { foreignKey: "message_id", as: "reactions" });
User.hasMany(ChatMessageReaction, { foreignKey: "user_id", as: "chatMessageReactions" });

Attachment.belongsTo(ChatMessage, { foreignKey: "chat_message_id", as: "chatMessage" });
ChatMessage.hasMany(Attachment, { foreignKey: "chat_message_id", as: "attachments" });

// ── Task Types ─────────────────────────────────────────────────────────────
TaskType.belongsTo(Team, { foreignKey: "team_id", as: "team" });
Team.hasMany(TaskType, { foreignKey: "team_id", as: "taskTypes" });

export {
  sequelize,
  User,
  Team,
  Task,
  Comment,
  CommentReaction,
  Activity,
  Escalation,
  Project,
  ProjectMember,
  ProjectNote,
  Notification,
  Attachment,
  Board,
  TaskType,
  Meta,
  Otp,
  TaskMember,
  ChatConversation,
  ChatMessage,
  ChatMessageReaction,
  ChatGroupMember,
};

export default {
  sequelize,
  User,
  Team,
  Task,
  Comment,
  CommentReaction,
  Activity,
  Escalation,
  Project,
  ProjectMember,
  ProjectNote,
  Notification,
  Attachment,
  Board,
  TaskType,
  Meta,
  Otp,
  TaskMember,
  ChatConversation,
  ChatMessage,
  ChatMessageReaction,
  ChatGroupMember,
};
