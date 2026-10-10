import { PaymentMethod } from "../../config/constants";

export interface PaymentIntentInput {
  orderNumber: string;
  /** Dollar amount (compat). Prefer amountCents. */
  amount: number;
  amountCents?: number;
  method: PaymentMethod;
  customerId: string;
}

export interface PaymentIntent {
  provider: PaymentMethod;
  status: "created" | "pending" | "paid";
  reference: string;
  clientPayload?: Record<string, string | number>;
}

export interface PaymentResult {
  success: boolean;
  reference: string;
  status: "paid" | "failed" | "pending";
}

export interface RefundResult {
  success: boolean;
  reference: string;
}

export interface PaymentVerifyExtra {
  /** Square Web Payments SDK card token (nonce). */
  sourceId?: string;
  /**
   * Optional SCA verification token from verifyBuyer / older SDK flows.
   * Modern Card.tokenize(verificationDetails) embeds verification in sourceId.
   */
  verificationToken?: string;
  /** Idempotency key for Square CreatePayment / refunds. */
  idempotencyKey?: string;
  /** Human order number for Square note. */
  orderId?: string;
  /** Expected charge amount in integer cents (authoritative server total). */
  amountCents?: number;
  /** Expected ISO currency (e.g. CAD). */
  currency?: string;
}

export interface PaymentProvider {
  createPayment(input: PaymentIntentInput): Promise<PaymentIntent>;
  verifyPayment(reference: string, amount: number, extra?: PaymentVerifyExtra): Promise<PaymentResult>;
  refundPayment(reference: string, amount: number): Promise<RefundResult>;
}
