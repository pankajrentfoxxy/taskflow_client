import express from "express";
import Joi from "joi";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import * as taskTypesController from "../controllers/taskTypesController.js";

const router = express.Router();

router.use(auth());

router.get("/", taskTypesController.listTaskTypes);

router.post(
  "/",
  validate({
    body: Joi.object({
      teamId: Joi.number().integer().required(),
      name: Joi.string().required(),
      description: Joi.string().allow(""),
    }),
  }),
  taskTypesController.createTaskType
);

router.patch(
  "/",
  validate({
    body: Joi.object({
      id: Joi.number().integer().required(),
      name: Joi.string(),
      isActive: Joi.boolean(),
    }),
  }),
  taskTypesController.updateTaskType
);

router.delete(
  "/",
  validate({
    query: Joi.object({
      id: Joi.number().integer().required(),
    }),
  }),
  taskTypesController.deleteTaskType
);

export default router;
