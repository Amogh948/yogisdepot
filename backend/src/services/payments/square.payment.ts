import { CAD_CURRENCY } from "../../utils/money";
import { PaymentResult } from "./payment.types";

export function mapSquarePaymentStatus(status: string | undefined): "paid" | "failed" | "pending" {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "COMPLETED" || normalized === "APPROVED") return "paid";
  if (normalized === "PENDING" || normalized === "AUTHORIZED") return "pending";
  return "failed";
}

export function validateChargeAgainstOrder(input: {
  expectedCents: number;
  expectedCurrency: string;
  chargedAmount?: bigint | number | null;
  chargedCurrency?: string | null;
}): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(input.expectedCents) || input.expectedCents <= 0) {
    return { ok: false, reason: "invalid_expected_amount" };
  }
  if (String(input.expectedCurrency || "").toUpperCase() !== CAD_CURRENCY) {
    return { ok: false, reason: "invalid_expected_currency" };
  }
  if (input.chargedAmount != null) {
    const charged =
      typeof input.chargedAmount === "bigint" ? input.chargedAmount : BigInt(Math.round(input.chargedAmount));
    if (charged !== BigInt(input.expectedCents)) {
      return { ok: false, reason: "amount_mismatch" };
    }
  }
  if (input.chargedCurrency) {
    if (String(input.chargedCurrency).toUpperCase() !== CAD_CURRENCY) {
      return { ok: false, reason: "currency_mismatch" };
    }
  }
  return { ok: true };
}

export function toPaymentResult(input: {
  paymentId?: string | null;
  status?: string | null;
  expectedCents: number;
  expectedCurrency: string;
  chargedAmount?: bigint | number | null;
  chargedCurrency?: string | null;
  fallbackReference: string;
}): PaymentResult {
  if (!input.paymentId) {
    return { success: false, reference: input.fallbackReference, status: "failed" };
  }
  const match = validateChargeAgainstOrder({
    expectedCents: input.expectedCents,
    expectedCurrency: input.expectedCurrency,
    chargedAmount: input.chargedAmount,
    chargedCurrency: input.chargedCurrency,
  });
  if (!match.ok) {
    return { success: false, reference: input.paymentId, status: "failed" };
  }
  const mapped = mapSquarePaymentStatus(input.status || undefined);
  if (mapped === "failed") {
    return { success: false, reference: input.paymentId, status: "failed" };
  }
  return { success: true, reference: input.paymentId, status: mapped };
}

/** True when a CreatePayment failure may still have created a payment (timeout/network). */
export function isUncertainSquareFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("socket")
  );
}
