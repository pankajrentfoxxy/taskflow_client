import express from "express";
import auth from "../middlewares/auth.js";
import * as reportsController from "../controllers/reportsController.js";

const router = express.Router();

router.use(auth());

router.get("/", reportsController.getReports);

export default router;
