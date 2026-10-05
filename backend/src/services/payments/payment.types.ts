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
  paymentId?: string;
  signature?: string;
}

export interface PaymentProvider {
  createPayment(input: PaymentIntentInput): Promise<PaymentIntent>;
  verifyPayment(reference: string, amount: number, extra?: PaymentVerifyExtra): Promise<PaymentResult>;
  refundPayment(reference: string, amount: number): Promise<RefundResult>;
}
