import { describe, expect, it, vi } from "vitest";
import {
  isUncertainSquareFailure,
  mapSquarePaymentStatus,
  toPaymentResult,
  validateChargeAgainstOrder,
} from "./square.payment";
import { SquareProvider } from "./square.provider";
import {
  assertSquareWebhookSignature,
  processSquarePaymentWebhook,
} from "./squareWebhook.service";

describe("mapSquarePaymentStatus", () => {
  it("maps successful Square statuses to paid", () => {
    expect(mapSquarePaymentStatus("COMPLETED")).toBe("paid");
    expect(mapSquarePaymentStatus("APPROVED")).toBe("paid");
  });

  it("maps pending statuses without confirming paid", () => {
    expect(mapSquarePaymentStatus("PENDING")).toBe("pending");
    expect(mapSquarePaymentStatus("AUTHORIZED")).toBe("pending");
  });

  it("maps failed/unknown statuses to failed", () => {
    expect(mapSquarePaymentStatus("FAILED")).toBe("failed");
    expect(mapSquarePaymentStatus("")).toBe("failed");
  });
});

describe("validateChargeAgainstOrder", () => {
  it("rejects incorrect amount or currency", () => {
    expect(
      validateChargeAgainstOrder({
        expectedCents: 4447,
        expectedCurrency: "CAD",
        chargedAmount: BigInt(100),
        chargedCurrency: "CAD",
      }).ok,
    ).toBe(false);
    expect(
      validateChargeAgainstOrder({
        expectedCents: 4447,
        expectedCurrency: "USD",
        chargedAmount: BigInt(4447),
        chargedCurrency: "USD",
      }).ok,
    ).toBe(false);
  });

  it("accepts matching CAD cents", () => {
    expect(
      validateChargeAgainstOrder({
        expectedCents: 4447,
        expectedCurrency: "CAD",
        chargedAmount: BigInt(4447),
        chargedCurrency: "CAD",
      }),
    ).toEqual({ ok: true });
  });
});

describe("toPaymentResult", () => {
  it("never marks paid for pending Square payment", () => {
    const result = toPaymentResult({
      paymentId: "pay_1",
      status: "PENDING",
      expectedCents: 1000,
      expectedCurrency: "CAD",
      chargedAmount: BigInt(1000),
      chargedCurrency: "CAD",
      fallbackReference: "sq_ref",
    });
    expect(result).toEqual({ success: true, reference: "pay_1", status: "pending" });
  });

  it("rejects forged success without Square payment id", () => {
    const result = toPaymentResult({
      paymentId: null,
      status: "COMPLETED",
      expectedCents: 1000,
      expectedCurrency: "CAD",
      fallbackReference: "sq_ref",
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
  });
});

describe("SquareProvider.verifyPayment", () => {
  it("charges with server amount/currency and idempotency key", async () => {
    const create = vi.fn().mockResolvedValue({
      payment: {
        id: "pay_ok",
        status: "COMPLETED",
        amountMoney: { amount: BigInt(4447), currency: "CAD" },
      },
    });
    const provider = new SquareProvider(() => ({
      payments: { create, get: vi.fn() },
      refunds: { refundPayment: vi.fn() },
    }));

    const result = await provider.verifyPayment("sq_YD_1", 44.47, {
      sourceId: "tok_challenge_ok",
      amountCents: 4447,
      currency: "CAD",
      idempotencyKey: "pay_order1",
      orderId: "YD-1",
    });

    expect(result).toEqual({ success: true, reference: "pay_ok", status: "paid" });
    expect(create).toHaveBeenCalledOnce();
    const body = create.mock.calls[0][0] as Record<string, unknown>;
    expect(body.idempotencyKey).toBe("pay_order1");
    expect(body.sourceId).toBe("tok_challenge_ok");
    expect(body.amountMoney).toEqual({ amount: BigInt(4447), currency: "CAD" });
  });

  it("supports optional verificationToken for legacy SDK paths", async () => {
    const create = vi.fn().mockResolvedValue({
      payment: {
        id: "pay_vt",
        status: "COMPLETED",
        amountMoney: { amount: BigInt(1000), currency: "CAD" },
      },
    });
    const provider = new SquareProvider(() => ({
      payments: { create, get: vi.fn() },
      refunds: { refundPayment: vi.fn() },
    }));

    await provider.verifyPayment("sq_ref", 10, {
      sourceId: "tok_1",
      verificationToken: "vt_1",
      amountCents: 1000,
      currency: "CAD",
      idempotencyKey: "pay_x",
    });
    expect((create.mock.calls[0][0] as { verificationToken?: string }).verificationToken).toBe("vt_1");
  });

  it("rejects declined Square payments", async () => {
    const provider = new SquareProvider(() => ({
      payments: {
        create: vi.fn().mockResolvedValue({
          payment: {
            id: "pay_fail",
            status: "FAILED",
            amountMoney: { amount: BigInt(1000), currency: "CAD" },
          },
        }),
        get: vi.fn(),
      },
      refunds: { refundPayment: vi.fn() },
    }));
    const result = await provider.verifyPayment("sq_ref", 10, {
      sourceId: "cnon:card-nonce-declined",
      amountCents: 1000,
      currency: "CAD",
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
  });

  it("rejects amount mismatches from Square", async () => {
    const provider = new SquareProvider(() => ({
      payments: {
        create: vi.fn().mockResolvedValue({
          payment: {
            id: "pay_bad_amt",
            status: "COMPLETED",
            amountMoney: { amount: BigInt(9999), currency: "CAD" },
          },
        }),
        get: vi.fn(),
      },
      refunds: { refundPayment: vi.fn() },
    }));
    const result = await provider.verifyPayment("sq_ref", 10, {
      sourceId: "tok_1",
      amountCents: 1000,
      currency: "CAD",
    });
    expect(result.success).toBe(false);
  });

  it("returns pending on uncertain Square timeout (never paid)", async () => {
    const provider = new SquareProvider(() => ({
      payments: {
        create: vi.fn().mockRejectedValue(new Error("timeout contacting Square")),
        get: vi.fn(),
      },
      refunds: { refundPayment: vi.fn() },
    }));
    const result = await provider.verifyPayment("sq_ref", 10, {
      sourceId: "tok_1",
      amountCents: 1000,
      currency: "CAD",
    });
    expect(result).toEqual({ success: true, reference: "", status: "pending" });
  });

  it("fails when sourceId is missing (forged client success)", async () => {
    const create = vi.fn();
    const provider = new SquareProvider(() => ({
      payments: { create, get: vi.fn() },
      refunds: { refundPayment: vi.fn() },
    }));
    const result = await provider.verifyPayment("sq_ref", 10, { amountCents: 1000, currency: "CAD" });
    expect(result.success).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("isUncertainSquareFailure", () => {
  it("detects timeout-like failures", () => {
    expect(isUncertainSquareFailure(new Error("Request timed out"))).toBe(true);
    expect(isUncertainSquareFailure(new Error("CARD_DECLINED"))).toBe(false);
  });
});

describe("SquareProvider.refundPayment", () => {
  it("clamps refund to Square's remaining refundable amount", async () => {
    const refundPayment = vi.fn().mockResolvedValue({ refund: { id: "r1" } });
    const provider = new SquareProvider(() => ({
      payments: {
        create: vi.fn(),
        get: vi.fn().mockResolvedValue({
          payment: {
            id: "pay_1",
            status: "COMPLETED",
            amountMoney: { amount: BigInt(1000), currency: "CAD" },
            refundedMoney: { amount: BigInt(200), currency: "CAD" },
          },
        }),
      },
      refunds: { refundPayment },
    }));

    // Order asks for $10 (1000¢) but only 800¢ remains refundable.
    await provider.refundPayment("pay_1", 10);

    expect(refundPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pay_1",
        amountMoney: { amount: BigInt(800), currency: "CAD" },
      }),
    );
  });

  it("treats already-fully-refunded payments as success", async () => {
    const refundPayment = vi.fn();
    const provider = new SquareProvider(() => ({
      payments: {
        create: vi.fn(),
        get: vi.fn().mockResolvedValue({
          payment: {
            id: "pay_1",
            status: "COMPLETED",
            amountMoney: { amount: BigInt(1000), currency: "CAD" },
            refundedMoney: { amount: BigInt(1000), currency: "CAD" },
          },
        }),
      },
      refunds: { refundPayment },
    }));

    const result = await provider.refundPayment("pay_1", 10);
    expect(result.success).toBe(true);
    expect(refundPayment).not.toHaveBeenCalled();
  });
});

describe("square webhook processing", () => {
  it("rejects invalid signatures", async () => {
    const result = await assertSquareWebhookSignature({
      requestBody: "{}",
      signatureHeader: "bad",
      notificationUrl: "https://example.com/hooks",
      signatureKey: "test-signature-key",
      nodeEnv: "production",
      verifySignature: async () => false,
    });
    expect(result).toEqual({
      ok: false,
      status: 401,
      message: "Invalid Square webhook signature",
    });
  });

  it("deduplicates webhook events and does not double-mark paid", async () => {
    const markPaid = vi.fn();
    const first = await processSquarePaymentWebhook(
      {
        event_id: "evt_1",
        type: "payment.updated",
        data: { object: { payment: { id: "pay_1", status: "COMPLETED", reference_id: "sq_ref" } } },
      },
      {
        recordEvent: async () => "created",
        markPaid,
        getPayment: async () => ({ id: "pay_1", status: "COMPLETED" }),
      },
    );
    expect(first).toEqual({ ok: true, markedPaid: true });
    expect(markPaid).toHaveBeenCalledOnce();

    const second = await processSquarePaymentWebhook(
      {
        event_id: "evt_1",
        type: "payment.updated",
        data: { object: { payment: { id: "pay_1", status: "COMPLETED" } } },
      },
      {
        recordEvent: async () => "duplicate",
        markPaid,
      },
    );
    expect(second).toEqual({ ok: true, deduplicated: true });
    expect(markPaid).toHaveBeenCalledOnce();
  });

  it("does not mark paid for failed payment events", async () => {
    const markPaid = vi.fn();
    const result = await processSquarePaymentWebhook(
      {
        event_id: "evt_fail",
        type: "payment.updated",
        data: { object: { payment: { id: "pay_f", status: "FAILED" } } },
      },
      { recordEvent: async () => "created", markPaid },
    );
    expect(result).toEqual({ ok: true, markedPaid: false });
    expect(markPaid).not.toHaveBeenCalled();
  });
});
