import express from "express";
import Joi from "joi";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import * as projectsController from "../controllers/projectsController.js";

const router = express.Router();

router.use(auth());

router.get("/", projectsController.listProjects);

router.post(
  "/",
  validate({
    body: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().allow(""),
    }),
  }),
  projectsController.createProject
);

router.get("/:id", projectsController.getProject);

router.patch(
  "/:id",
  validate({
    body: Joi.object({
      addMemberId: Joi.number().integer(),
      removeMemberId: Joi.number().integer(),
      note: Joi.string(),
      togglePinNoteId: Joi.number().integer(),
      description: Joi.string(),
    }),
  }),
  projectsController.updateProject
);

export default router;
