import dotenv from "dotenv";
import path from "path";
import Joi from "joi";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid("production", "development", "test").default("development"),
    PORT: Joi.number().default(8000),
    JWT_SECRET: Joi.string().required(),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(43200),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30),
    DB_HOST: Joi.string().default("localhost"),
    DB_PORT: Joi.number().default(5432),
    DB_NAME: Joi.string().required(),
    DB_USER: Joi.string().required(),
    DB_PASSWORD: Joi.string().allow("").required(),
    CORS_ORIGIN: Joi.string().default("http://localhost:6070"),
    UPLOAD_DIR: Joi.string().default("uploads"),
    MAX_UPLOAD_BYTES: Joi.number().default(26214400),
    SMTP_HOST: Joi.string().allow("").default(""),
    SMTP_PORT: Joi.number().default(587),
    SMTP_SECURE: Joi.string().valid("true", "false", "").default("false"),
    SMTP_USER: Joi.string().allow("").default(""),
    SMTP_PASS: Joi.string().allow("").default(""),
    SMTP_FROM: Joi.string().allow("").default(""),
    APP_NAME: Joi.string().default("TaskFlow"),
    OTP_EXPIRY_MINUTES: Joi.number().default(10),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: "key" } }).validate(process.env);
if (error) throw new Error(`Config validation error: ${error.message}`);

export default {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
  },
  db: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    name: envVars.DB_NAME,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
  },
  corsOrigin: envVars.CORS_ORIGIN.split(",").map((o) => o.trim()),
  uploadDir: envVars.UPLOAD_DIR,
  maxUploadBytes: envVars.MAX_UPLOAD_BYTES,
  cronSecret: "TF_CRON_k8mP2xQ4nR8vL3wJ6hT9yB5",
  smtp: {
    host: envVars.SMTP_HOST,
    port: envVars.SMTP_PORT,
    secure: envVars.SMTP_SECURE === "true",
    user: envVars.SMTP_USER,
    pass: envVars.SMTP_PASS,
    from: envVars.SMTP_FROM || `"${envVars.APP_NAME}" <${envVars.SMTP_USER || "noreply@taskflow.local"}>`,
  },
  app: {
    name: envVars.APP_NAME,
  },
  otp: {
    expiryMinutes: envVars.OTP_EXPIRY_MINUTES,
  },
  ceoReport: {
    hour: 21,
    timezone: "Asia/Kolkata",
  },
};
