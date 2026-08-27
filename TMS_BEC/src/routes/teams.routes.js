import express from "express";
import Joi from "joi";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import * as teamsController from "../controllers/teamsController.js";

const router = express.Router();

router.use(auth());

router.get("/", teamsController.listTeams);

router.post(
  "/",
  auth("ADMIN"),
  validate({
    body: Joi.object({
      name: Joi.string().required(),
      managerId: Joi.number().integer().allow(null),
    }),
  }),
  teamsController.createTeam
);

router.patch(
  "/",
  auth("ADMIN"),
  validate({
    body: Joi.object({
      id: Joi.number().integer().required(),
      name: Joi.string(),
      managerId: Joi.number().integer().allow(null),
      memberIds: Joi.array().items(Joi.number().integer()),
    }),
  }),
  teamsController.updateTeam
);

router.delete(
  "/",
  auth("ADMIN"),
  validate({
    query: Joi.object({
      id: Joi.number().integer().required(),
    }),
  }),
  teamsController.deleteTeam
);

export default router;
