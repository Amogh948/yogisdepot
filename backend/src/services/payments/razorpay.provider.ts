import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../../config/env";
import { BadRequestError } from "../../errors/AppError";
import { CAD_CURRENCY } from "../../utils/money";
import { PaymentIntent, PaymentIntentInput, PaymentProvider, PaymentResult, RefundResult } from "./payment.types";

function client(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new BadRequestError("Razorpay is not configured");
  }
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
}

function amountCents(input: PaymentIntentInput): number {
  if (typeof input.amountCents === "number") return Math.round(input.amountCents);
  return Math.round(input.amount * 100);
}

/**
 * Razorpay is India-oriented; currency is set to CAD for market consistency.
 * If the Razorpay account cannot settle CAD, configure an alternate CAD provider later.
 */
export class RazorpayProvider implements PaymentProvider {
  async createPayment(input: PaymentIntentInput): Promise<PaymentIntent> {
    const cents = amountCents(input);
    const order = await client().orders.create({
      amount: cents,
      currency: CAD_CURRENCY,
      receipt: input.orderNumber.slice(0, 40),
      notes: {
        orderNumber: input.orderNumber,
        customerId: input.customerId,
      },
    });
    return {
      provider: "razorpay",
      status: "created",
      reference: order.id,
      clientPayload: {
        keyId: env.RAZORPAY_KEY_ID,
        razorpayOrderId: order.id,
        amount: cents,
        currency: CAD_CURRENCY,
        name: "Yogis Depot",
      },
    };
  }

  async verifyPayment(reference: string, _amount: number, extra?: { paymentId?: string; signature?: string }): Promise<PaymentResult> {
    if (!extra?.paymentId || !extra.signature) {
      return { success: false, reference, status: "failed" };
    }
    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${reference}|${extra.paymentId}`)
      .digest("hex");
    if (expected !== extra.signature) {
      return { success: false, reference, status: "failed" };
    }
    return { success: true, reference: extra.paymentId, status: "paid" };
  }

  async refundPayment(reference: string, amount: number): Promise<RefundResult> {
    const refund = (await client().payments.refund(reference, {
      amount: Math.round(amount * 100),
    })) as { id?: string };
    return { success: true, reference: refund.id || reference };
  }
}
