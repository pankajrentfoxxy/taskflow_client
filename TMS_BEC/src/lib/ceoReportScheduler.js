import cron from "node-cron";
import config from "../config/config.js";
import logger from "../config/logger.js";
import { runDailyCeoReport } from "../services/ceoReportService.js";

let running = false;

export function startCeoReportScheduler() {
  if (config.env !== "production") {
    logger.info("CEO daily report scheduler disabled (not production)");
    return;
  }

  const hour = config.ceoReport.hour;
  const cronExpr = `0 ${hour} * * *`;

  cron.schedule(
    cronExpr,
    async () => {
      if (running) {
        logger.warn("CEO daily report skipped — previous run still in progress");
        return;
      }
      running = true;
      try {
        const result = await runDailyCeoReport({ trigger: "scheduler" });
        if (result.skipped) {
          logger.info(`CEO daily report skipped: ${result.reason}`);
        }
      } catch (err) {
        logger.error("CEO daily report failed", err);
      } finally {
        running = false;
      }
    },
    { timezone: config.ceoReport.timezone }
  );

  logger.info(
    `CEO daily report scheduler started (${String(hour).padStart(2, "0")}:00 ${config.ceoReport.timezone})`
  );
}

export default { startCeoReportScheduler };
