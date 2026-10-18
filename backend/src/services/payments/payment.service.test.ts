import { describe, expect, it } from "vitest";
import { PaymentService } from "./payment.service";

describe("PaymentService", () => {
  it("rejects COD for new checkouts", async () => {
    await expect(
      PaymentService.createPayment({
        orderNumber: "YD-1",
        amount: 199,
        // @ts-expect-error COD is no longer a storefront payment method
        method: "cod",
        customerId: "user1",
      }),
    ).rejects.toThrow(/Unsupported payment method/i);
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
