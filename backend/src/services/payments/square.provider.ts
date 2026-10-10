import { randomUUID } from "crypto";
import { SquareClient, SquareEnvironment } from "square";
import { env } from "../../config/env";
import { BadRequestError } from "../../errors/AppError";
import { CAD_CURRENCY } from "../../utils/money";
import {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
  PaymentResult,
  PaymentVerifyExtra,
  RefundResult,
} from "./payment.types";

function assertConfigured() {
  if (!env.SQUARE_APPLICATION_ID || !env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) {
    throw new BadRequestError("Square is not configured");
  }
}

function client(): SquareClient {
  assertConfigured();
  return new SquareClient({
    token: env.SQUARE_ACCESS_TOKEN,
    environment:
      env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
}

function amountCents(input: PaymentIntentInput): number {
  if (typeof input.amountCents === "number") return Math.round(input.amountCents);
  return Math.round(input.amount * 100);
}

function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export class SquareProvider implements PaymentProvider {
  async createPayment(input: PaymentIntentInput): Promise<PaymentIntent> {
    assertConfigured();
    const cents = amountCents(input);
    const reference = `sq_${input.orderNumber}_${randomUUID().slice(0, 8)}`;
    return {
      provider: "square",
      status: "created",
      reference,
      clientPayload: {
        applicationId: env.SQUARE_APPLICATION_ID,
        locationId: env.SQUARE_LOCATION_ID,
        environment: env.SQUARE_ENVIRONMENT,
        amountCents: cents,
        currency: CAD_CURRENCY,
        reference,
        name: "Yogis Depot",
      },
    };
  }

  async verifyPayment(
    reference: string,
    amount: number,
    extra?: PaymentVerifyExtra,
  ): Promise<PaymentResult> {
    if (!extra?.sourceId) {
      return { success: false, reference, status: "failed" };
    }
    const cents = dollarsToCents(amount);
    if (cents <= 0) {
      return { success: false, reference, status: "failed" };
    }

    try {
      const response = await client().payments.create({
        sourceId: extra.sourceId,
        idempotencyKey: extra.idempotencyKey || randomUUID(),
        amountMoney: {
          amount: BigInt(cents),
          currency: CAD_CURRENCY,
        },
        locationId: env.SQUARE_LOCATION_ID,
        referenceId: reference.slice(0, 40),
        note: extra.orderId ? `Yogis Depot order ${extra.orderId}` : `Yogis Depot ${reference}`,
        autocomplete: true,
      });

      const payment = response.payment;
      const status = String(payment?.status || "").toUpperCase();
      const paymentId = payment?.id;
      if (!paymentId || (status !== "COMPLETED" && status !== "APPROVED")) {
        return { success: false, reference: paymentId || reference, status: "failed" };
      }
      return { success: true, reference: paymentId, status: "paid" };
    } catch {
      return { success: false, reference, status: "failed" };
    }
  }

  async refundPayment(paymentId: string, amount: number): Promise<RefundResult> {
    assertConfigured();
    if (!paymentId) {
      throw new BadRequestError("Missing Square payment id for refund");
    }
    const cents = dollarsToCents(amount);
    const response = await client().refunds.refundPayment({
      idempotencyKey: randomUUID(),
      paymentId,
      amountMoney: {
        amount: BigInt(cents),
        currency: CAD_CURRENCY,
      },
    });
    return { success: true, reference: response.refund?.id || paymentId };
  }
}
