import { describe, expect, it } from "vitest";
import { PaymentService } from "./payment.service";

describe("PaymentService", () => {
  it("creates a COD intent as pending", async () => {
    const intent = await PaymentService.createPayment({
      orderNumber: "YD-1",
      amount: 199,
      method: "cod",
      customerId: "user1",
    });
    expect(intent.provider).toBe("cod");
    expect(intent.status).toBe("pending");
  });

  it("creates and verifies mock online payments", async () => {
    const intent = await PaymentService.createPayment({
      orderNumber: "YD-2",
      amount: 499,
      method: "mock_online",
      customerId: "user1",
    });
    expect(intent.reference.startsWith("mock_")).toBe(true);
    const verified = await PaymentService.verifyPayment("mock_online", intent.reference, 499);
    expect(verified.success).toBe(true);
    expect(verified.status).toBe("paid");
  });
});
