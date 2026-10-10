import { env } from "../../config/env";
import { SquareWebhookEvent } from "../../models/SquareWebhookEvent";
import { orderService } from "../orders/order.service";
import { SquareProvider } from "./square.provider";

export type SquarePaymentWebhookEvent = {
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

export type SquareWebhookProcessResult =
  | { ok: true; deduplicated?: boolean; markedPaid?: boolean }
  | { ok: false; status: number; message: string };

export async function assertSquareWebhookSignature(input: {
  requestBody: string;
  signatureHeader: string;
  notificationUrl: string;
  signatureKey?: string;
  nodeEnv?: string;
  verifySignature: (args: {
    requestBody: string;
    signatureHeader: string;
    signatureKey: string;
    notificationUrl: string;
  }) => Promise<boolean>;
}): Promise<SquareWebhookProcessResult | null> {
  const signatureKey = input.signatureKey ?? env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const nodeEnv = input.nodeEnv ?? env.NODE_ENV;
  if (!signatureKey) {
    if (nodeEnv === "production") {
      return { ok: false, status: 503, message: "Square webhook signature key is not configured" };
    }
    return null;
  }
  const valid = await input.verifySignature({
    requestBody: input.requestBody,
    signatureHeader: input.signatureHeader,
    signatureKey,
    notificationUrl: input.notificationUrl,
  });
  if (!valid) {
    return { ok: false, status: 401, message: "Invalid Square webhook signature" };
  }
  return null;
}

export async function processSquarePaymentWebhook(
  event: SquarePaymentWebhookEvent,
  deps: {
    getPayment?: (paymentId: string) => Promise<{ id: string; status: string; referenceId?: string } | null>;
    markPaid?: typeof orderService.markPaidFromSquareWebhook;
    recordEvent?: (input: { eventId: string; eventType: string; paymentId?: string }) => Promise<"created" | "duplicate">;
  } = {},
): Promise<SquareWebhookProcessResult> {
  const eventId = event.event_id || event.eventId || "";
  const eventType = String(event.type || "");
  const payment = event.data?.object?.payment;

  if (eventId) {
    const record =
      deps.recordEvent ||
      (async ({ eventId: id, eventType: type, paymentId }) => {
        try {
          await SquareWebhookEvent.create({
            eventId: id,
            eventType: type,
            paymentId,
            processedAt: new Date(),
          });
          return "created" as const;
        } catch (error) {
          const code = (error as { code?: string })?.code;
          if (code === "11000") return "duplicate" as const;
          throw error;
        }
      });
    const recorded = await record({
      eventId,
      eventType,
      paymentId: payment?.id,
    });
    if (recorded === "duplicate") {
      return { ok: true, deduplicated: true };
    }
  }

  const type = eventType.toLowerCase();
  if (!payment || !(type.includes("payment") || event.data?.type === "payment")) {
    return { ok: true };
  }

  let status = String(payment.status || "").toUpperCase();
  let paymentId = payment.id;
  let referenceId = payment.reference_id || payment.referenceId;
  const getPayment = deps.getPayment || ((id: string) => new SquareProvider().getPayment(id));

  if (paymentId && (!status || status === "PENDING")) {
    const live = await getPayment(paymentId);
    if (live) {
      status = String(live.status || status).toUpperCase();
      referenceId = referenceId || live.referenceId;
      paymentId = live.id;
    }
  }

  if (status !== "COMPLETED" && status !== "APPROVED") {
    return { ok: true, markedPaid: false };
  }

  const markPaid = deps.markPaid || orderService.markPaidFromSquareWebhook.bind(orderService);
  await markPaid({ paymentId, referenceId, status });
  return { ok: true, markedPaid: true };
}
