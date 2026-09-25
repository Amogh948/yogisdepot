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
