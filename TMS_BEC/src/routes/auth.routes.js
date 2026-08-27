import express from "express";
import Joi from "joi";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import * as authController from "../controllers/authController.js";

const router = express.Router();

router.post(
  "/login",
  validate({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
  }),
  authController.login
);

router.post(
  "/forgot-password",
  validate({
    body: Joi.object({
      email: Joi.string().email().required(),
    }),
  }),
  authController.forgotPassword
);

router.post(
  "/reset-password",
  validate({
    body: Joi.object({
      email: Joi.string().email().required(),
      otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
        "string.length": "Enter the 6-digit verification code",
        "string.pattern.base": "Enter the 6-digit verification code",
      }),
      newPassword: Joi.string().min(6).required(),
      confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required().messages({
        "any.only": "New passwords do not match",
      }),
    }),
  }),
  authController.resetPassword
);

router.post("/logout", authController.logout);

router.post("/refresh", authController.refresh);

export default router;
