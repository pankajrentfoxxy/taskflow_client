import winston from "winston";
import config from "./config.js";

const logger = winston.createLogger({
  level: config.env === "development" ? "debug" : "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
