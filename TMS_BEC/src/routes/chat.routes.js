import express from "express";
import Joi from "joi";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import * as chatController from "../controllers/chatController.js";

const router = express.Router();

router.use(auth());

router.get("/targets", chatController.listTargets);
router.get("/conversations", chatController.listConversations);
router.get("/groups", chatController.listGroups);
router.get("/groups/:id", chatController.getGroupDetail);

router.post(
  "/groups",
  validate({
    body: Joi.object({
      name: Joi.string().trim().min(1).max(140).required(),
      memberIds: Joi.array().items(Joi.number().integer()).min(1).required(),
    }),
  }),
  chatController.createGroup
);

router.patch(
  "/groups/:id",
  validate({
    body: Joi.object({
      name: Joi.string().trim().min(1).max(140).optional(),
      memberIds: Joi.array().items(Joi.number().integer()).min(1).optional(),
    }).min(1),
  }),
  chatController.updateGroup
);

router.post(
  "/open",
  validate({
    body: Joi.object({
      userId: Joi.number().integer().optional(),
    }),
  }),
  chatController.openConversation
);

router.post("/groups/:id/open", chatController.openGroup);

router.get("/conversations/:id/messages", chatController.getMessages);

router.post(
  "/conversations/:id/messages",
  validate({
    body: Joi.object({
      body: Joi.string().allow("").max(8000).default(""),
      parentMessageId: Joi.number().integer().allow(null).optional(),
      attachmentIds: Joi.array().items(Joi.number().integer()).optional(),
    }),
  }),
  chatController.sendMessage
);

router.patch(
  "/messages/:messageId",
  validate({
    body: Joi.object({
      body: Joi.string().allow("").max(8000).required(),
    }),
  }),
  chatController.editMessage
);

router.delete("/messages/:messageId", chatController.deleteMessage);

router.post(
  "/messages/:messageId/reactions",
  validate({
    body: Joi.object({
      emoji: Joi.string().max(16).required(),
    }),
  }),
  chatController.toggleReaction
);

export default router;
