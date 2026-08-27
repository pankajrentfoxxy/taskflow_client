import express from "express";
import Joi from "joi";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import * as notificationsController from "../controllers/notificationsController.js";

const router = express.Router();

router.use(auth());

router.get("/", notificationsController.listNotifications);

router.post(
  "/",
  validate({
    body: Joi.object({
      ids: Joi.array().items(Joi.number().integer()),
      all: Joi.boolean(),
    }),
  }),
  notificationsController.markRead
);

router.post("/clear", notificationsController.clearAll);

export default router;
