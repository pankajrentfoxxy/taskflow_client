import http from "http";
import app, { initApp } from "./src/app.js";
import config from "./src/config/config.js";
import logger from "./src/config/logger.js";
import { initSocket } from "./src/lib/socket.js";

await initApp();

if (config.env === "production") {
  const { startCeoReportScheduler } = await import("./src/lib/ceoReportScheduler.js");
  startCeoReportScheduler();
}

const server = http.createServer(app);
initSocket(server);

server.listen(config.port, () => {
  logger.info(`TaskFlow API listening on port ${config.port}`);
});

const exitHandler = () => {
  if (server) server.close(() => process.exit(1));
  else process.exit(1);
};

process.on("uncaughtException", (err) => {
  logger.error(err);
  exitHandler();
});
process.on("unhandledRejection", (err) => {
  logger.error(err);
  exitHandler();
});
process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  server.close();
});
