import express from "express";
import Joi from "joi";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import * as boardsController from "../controllers/boardsController.js";

const router = express.Router();

router.use(auth());

router.get("/", boardsController.listBoards);

router.post(
  "/",
  validate({
    body: Joi.object({
      id: Joi.number().integer(),
      name: Joi.string().required(),
      scene: Joi.any(),
    }),
  }),
  boardsController.saveBoard
);

router.delete("/", boardsController.deleteBoard);

export default router;
