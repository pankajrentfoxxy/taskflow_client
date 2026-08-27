import express from "express";
import * as cronController from "../controllers/cronController.js";

const router = express.Router();

router.get("/sla-check", cronController.slaCheck);
router.get("/ceo-daily-report", cronController.ceoDailyReport);

export default router;
