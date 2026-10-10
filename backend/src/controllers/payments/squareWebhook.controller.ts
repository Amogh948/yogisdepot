import { Request, Response } from "express";
import { WebhooksHelper } from "square";
import { env } from "../../config/env";
import { SquareWebhookEvent } from "../../models/SquareWebhookEvent";
import { orderService } from "../../services/orders/order.service";
import { SquareProvider } from "../../services/payments/square.provider";
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
  event_id?: string;
  eventId?: string;
  type?: string;
  data?: {
    type?: string;
    id?: string;
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

    if (!env.SQUARE_WEBHOOK_SIGNATURE_KEY) {
      // In production, unsigned webhooks must not mutate order state.
      if (env.NODE_ENV === "production") {
        res.status(503).json({ success: false, message: "Square webhook signature key is not configured" });
        return;
      }
    } else {
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

    const eventId = event.event_id || event.eventId || "";
    const eventType = String(event.type || "");
    if (eventId) {
      try {
        await SquareWebhookEvent.create({
          eventId,
          eventType,
          paymentId: event.data?.object?.payment?.id,
          processedAt: new Date(),
        });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        // Duplicate delivery — acknowledge without reprocessing.
        if (code === "11000") {
          res.status(200).json({ success: true, deduplicated: true });
          return;
        }
        throw error;
      }
    }

    const type = eventType.toLowerCase();
    const payment = event.data?.object?.payment;
    if (payment && (type.includes("payment") || event.data?.type === "payment")) {
      let status = String(payment.status || "").toUpperCase();
      let paymentId = payment.id;
      let referenceId = payment.reference_id || payment.referenceId;

      // Reconcile with Square when the payload is incomplete or status is ambiguous.
      if (paymentId && (!status || status === "PENDING")) {
        const live = await new SquareProvider().getPayment(paymentId);
        if (live) {
          status = String(live.status || status).toUpperCase();
          referenceId = referenceId || live.referenceId;
          paymentId = live.id;
        }
      }

      if (status === "COMPLETED" || status === "APPROVED") {
        await orderService.markPaidFromSquareWebhook({
          paymentId,
          referenceId,
          status,
        });
      }
    }

    res.status(200).json({ success: true });
  }),
};
