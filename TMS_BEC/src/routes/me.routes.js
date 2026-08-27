import express from "express";
import auth from "../middlewares/auth.js";
import * as meController from "../controllers/meController.js";

const router = express.Router();

router.get("/", auth(), meController.getMe);

export default router;
