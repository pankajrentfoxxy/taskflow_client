import express from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import * as sqlController from "../controllers/sqlController.js";

const router = express.Router();

router.post(
  "/query",
  validate({
    body: Joi.object({
      query: Joi.string().required(),
      replacements: Joi.object().unknown(true).optional(),
    }),
  }),
  sqlController.runQuery
);

export default router;
