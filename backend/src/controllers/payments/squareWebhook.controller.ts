import { Request, Response } from "express";
import { WebhooksHelper } from "square";
import { env } from "../../config/env";
import {
  assertSquareWebhookSignature,
  processSquarePaymentWebhook,
  SquarePaymentWebhookEvent,
} from "../../services/payments/squareWebhook.service";
import { asyncHandler } from "../../utils/asyncHandler";

function rawBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) {
    return req.body.toString("utf8");
  }
  if (typeof req.body === "string") {
    return req.body;
  }
  return JSON.stringify(req.body ?? {});
}

function notificationUrl(req: Request): string {
  if (env.SQUARE_WEBHOOK_NOTIFICATION_URL) {
    return env.SQUARE_WEBHOOK_NOTIFICATION_URL;
  }
  return `${req.protocol}://${req.get("host")}${req.originalUrl}`;
}

export const squareWebhookController = {
  handle: asyncHandler(async (req: Request, res: Response) => {
    const body = rawBody(req);
    const signature = String(req.header("x-square-hmacsha256-signature") || "");

    const signatureGate = await assertSquareWebhookSignature({
      requestBody: body,
      signatureHeader: signature,
      notificationUrl: notificationUrl(req),
      verifySignature: (args) => WebhooksHelper.verifySignature(args),
    });
    if (signatureGate && !signatureGate.ok) {
      res.status(signatureGate.status).json({ success: false, message: signatureGate.message });
      return;
    }

    let event: SquarePaymentWebhookEvent;
    try {
      event = JSON.parse(body) as SquarePaymentWebhookEvent;
    } catch {
      res.status(400).json({ success: false, message: "Invalid webhook payload" });
      return;
    }

    const result = await processSquarePaymentWebhook(event);
    if (!result.ok) {
      res.status(result.status).json({ success: false, message: result.message });
      return;
    }
    res.status(200).json({ success: true, deduplicated: Boolean(result.deduplicated) });
  }),
};
