import { runSlaSweep } from "../lib/cron.js";
import config from "../config/config.js";
import { runDailyCeoReport } from "./ceoReportService.js";

const verifyCronAuth = (authHeader, secretParam) => {
  const secret = config.cronSecret;
  if (!secret) return true;
  const auth = authHeader || "";
  return auth === `Bearer ${secret}` || secretParam === secret;
};
export const runSlaCheck = async (force, authHeader, secretParam) => {
  if (!verifyCronAuth(authHeader, secretParam)) {
    return { unauthorized: true };
  }

  const result = await runSlaSweep(force);
  return { ok: true, ...result };
};

export const runCeoReport = async (authHeader, secretParam, { force = false } = {}) => {
  if (!verifyCronAuth(authHeader, secretParam)) {
    return { unauthorized: true };
  }

  return runDailyCeoReport({ trigger: "cron_endpoint", force });
};

export default { runSlaCheck, runCeoReport };