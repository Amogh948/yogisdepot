import multer from "multer";
import { ALLOWED_IMAGE_MIME, MAX_UPLOAD_BYTES } from "../config/constants";
import { BadRequestError } from "../errors/AppError";

const storage = multer.memoryStorage();

export const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
      cb(new BadRequestError("Only JPEG, PNG, WebP, and GIF images are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const uploadCsv = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const okMime =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype === "application/csv" ||
      file.mimetype === "text/plain";
    if (!okMime && !name.endsWith(".csv")) {
      cb(new BadRequestError("Upload a .csv file"));
      return;
    }
    cb(null, true);
  },
});
