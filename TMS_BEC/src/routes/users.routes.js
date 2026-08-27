import express from "express";
import Joi from "joi";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import * as usersController from "../controllers/usersController.js";

const router = express.Router();

router.use(auth());

router.get("/", usersController.listUsers);

router.post(
  "/",
  auth("ADMIN"),
  validate({
    body: Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      role: Joi.string().valid("ADMIN", "CEO", "MANAGER", "MEMBER"),
      teamId: Joi.number().integer().allow(null),
    }),
  }),
  usersController.createUser
);

router.patch(
  "/",
  auth("ADMIN"),
  validate({
    body: Joi.object({
      id: Joi.number().integer().required(),
      role: Joi.string().valid("ADMIN", "CEO", "MANAGER", "MEMBER"),
      teamId: Joi.number().integer().allow(null),
      isActive: Joi.boolean(),
      password: Joi.string().min(6),
    }),
  }),
  usersController.updateUser
);

router.delete(
  "/",
  auth("ADMIN"),
  validate({
    query: Joi.object({
      id: Joi.number().integer().required(),
    }),
  }),
  usersController.deleteUser
);

export default router;
