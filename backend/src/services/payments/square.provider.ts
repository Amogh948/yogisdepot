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
import { isUncertainSquareFailure, toPaymentResult } from "./square.payment";

type PaymentsApi = {
  create: (body: Record<string, unknown>) => Promise<{
    payment?: {
      id?: string;
      status?: string;
      amountMoney?: { amount?: bigint | number; currency?: string };
      referenceId?: string;
    };
  }>;
  get: (body: { paymentId: string }) => Promise<{
    payment?: { id?: string; status?: string; referenceId?: string };
  }>;
};

type RefundsApi = {
  refundPayment: (body: Record<string, unknown>) => Promise<{ refund?: { id?: string } }>;
};

export type SquareApi = {
  payments: PaymentsApi;
  refunds: RefundsApi;
};

function assertConfigured() {
  if (!env.SQUARE_APPLICATION_ID || !env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) {
    throw new BadRequestError("Square is not configured");
  }
}

function defaultClient(): SquareApi {
  assertConfigured();
  const client = new SquareClient({
    token: env.SQUARE_ACCESS_TOKEN,
    environment:
      env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
  return client as unknown as SquareApi;
}

function amountCents(input: PaymentIntentInput): number {
  if (typeof input.amountCents === "number") return Math.round(input.amountCents);
  return Math.round(input.amount * 100);
}

function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export class SquareProvider implements PaymentProvider {
  constructor(private readonly apiFactory: () => SquareApi = defaultClient) {}

  private api(): SquareApi {
    return this.apiFactory();
  }

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

    const expectedCents =
      typeof extra.amountCents === "number" ? Math.round(extra.amountCents) : dollarsToCents(amount);
    const currency = (extra.currency || CAD_CURRENCY).toUpperCase();
    const idempotencyKey = extra.idempotencyKey || randomUUID();

    try {
      const response = await this.api().payments.create({
        sourceId: extra.sourceId,
        idempotencyKey,
        amountMoney: {
          amount: BigInt(expectedCents),
          currency: CAD_CURRENCY,
        },
        locationId: env.SQUARE_LOCATION_ID,
        referenceId: reference.slice(0, 40),
        note: extra.orderId ? `Yogis Depot order ${extra.orderId}` : `Yogis Depot ${reference}`,
        autocomplete: true,
        // Optional legacy field; modern Card.tokenize embeds SCA in sourceId.
        ...(extra.verificationToken ? { verificationToken: extra.verificationToken } : {}),
        customerDetails: {
          customerInitiated: true,
          sellerKeyedIn: false,
        },
      });

      return toPaymentResult({
        paymentId: response.payment?.id,
        status: response.payment?.status,
        expectedCents,
        expectedCurrency: currency,
        chargedAmount: response.payment?.amountMoney?.amount,
        chargedCurrency: response.payment?.amountMoney?.currency,
        fallbackReference: reference,
      });
    } catch (error) {
      // Do not invent a paid state on uncertain failures; leave pending for reconcile/webhook.
      if (isUncertainSquareFailure(error)) {
        return { success: true, reference: "", status: "pending" };
      }
      return { success: false, reference, status: "failed" };
    }
  }

  async getPayment(paymentId: string): Promise<{ id: string; status: string; referenceId?: string } | null> {
    if (!paymentId) return null;
    try {
      const response = await this.api().payments.get({ paymentId });
      const payment = response.payment;
      if (!payment?.id) return null;
      return {
        id: payment.id,
        status: String(payment.status || ""),
        referenceId: payment.referenceId || undefined,
      };
    } catch {
      return null;
    }
  }

  async refundPayment(paymentId: string, amount: number): Promise<RefundResult> {
    assertConfigured();
    if (!paymentId) {
      throw new BadRequestError("Missing Square payment id for refund");
    }
    const cents = dollarsToCents(amount);
    const response = await this.api().refunds.refundPayment({
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
