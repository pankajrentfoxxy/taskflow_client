import express from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import httpStatus from "http-status";
import config from "../config/config.js";
import auth from "../middlewares/auth.js";
import ApiError from "../utils/ApiError.js";
import * as uploadsController from "../controllers/uploadsController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadPath = path.isAbsolute(config.uploadDir)
  ? config.uploadDir
  : path.join(__dirname, "../..", config.uploadDir);

const ALLOWED_PREFIXES = [
  "image/",
  "audio/",
  "video/",
  "application/pdf",
  "text/",
  "application/vnd",
  "application/msword",
  "application/zip",
  "application/octet-stream",
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPath),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype || "application/octet-stream";
    if (!ALLOWED_PREFIXES.some((p) => mime.startsWith(p))) {
      return cb(new ApiError(httpStatus.BAD_REQUEST, `File type ${mime} not allowed`));
    }
    cb(null, true);
  },
});

const router = express.Router();

router.use(auth());

router.post("/", upload.single("file"), uploadsController.uploadFile);
router.get("/:id", uploadsController.getFile);
router.delete("/:id", uploadsController.deleteFile);

export default router;
