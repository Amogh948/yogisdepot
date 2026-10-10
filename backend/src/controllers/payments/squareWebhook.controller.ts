import { Request, Response } from "express";
import { WebhooksHelper } from "square";
import { env } from "../../config/env";
import { orderService } from "../../services/orders/order.service";
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

type SquarePaymentEvent = {
  type?: string;
  data?: {
    type?: string;
    object?: {
      payment?: {
        id?: string;
        status?: string;
        reference_id?: string;
        referenceId?: string;
      };
    };
  };
};

export const squareWebhookController = {
  handle: asyncHandler(async (req: Request, res: Response) => {
    const body = rawBody(req);
    const signature = String(req.header("x-square-hmacsha256-signature") || "");

    if (env.SQUARE_WEBHOOK_SIGNATURE_KEY) {
      const valid = await WebhooksHelper.verifySignature({
        requestBody: body,
        signatureHeader: signature,
        signatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY,
        notificationUrl: notificationUrl(req),
      });
      if (!valid) {
        res.status(401).json({ success: false, message: "Invalid Square webhook signature" });
        return;
      }
    }

    let event: SquarePaymentEvent;
    try {
      event = JSON.parse(body) as SquarePaymentEvent;
    } catch {
      res.status(400).json({ success: false, message: "Invalid webhook payload" });
      return;
    }

    const type = String(event.type || "").toLowerCase();
    const payment = event.data?.object?.payment;
    if (payment && (type.includes("payment") || event.data?.type === "payment")) {
      const status = String(payment.status || "").toUpperCase();
      if (status === "COMPLETED" || status === "APPROVED") {
        await orderService.markPaidFromSquareWebhook({
          paymentId: payment.id,
          referenceId: payment.reference_id || payment.referenceId,
          status,
        });
      }
    }

    res.status(200).json({ success: true });
  }),
};
