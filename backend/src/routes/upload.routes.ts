import { Router } from "express";
import { Request, Response } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { uploadImage } from "../middleware/upload.middleware";
import { uploadController } from "../controllers/admin/admin.controller";
import { squareWebhookController } from "../controllers/payments/squareWebhook.controller";
import { PaymentService } from "../services/payments/payment.service";
import { sendSuccess } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const uploadRoutes = Router();
uploadRoutes.use(authenticate);
uploadRoutes.post("/", uploadImage.array("files", 8), uploadController.upload);
uploadRoutes.get("/", uploadController.retrieve);

export const paymentRoutes = Router();
paymentRoutes.get(
  "/config",
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, PaymentService.publicConfig(), "Payment config fetched");
  }),
);

/** Mounted with express.raw in app.ts so the Square signature can be verified. */
export const squareWebhookRoutes = Router();
squareWebhookRoutes.post("/", squareWebhookController.handle);
