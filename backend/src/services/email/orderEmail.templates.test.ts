import { describe, expect, it } from "vitest";
import { estimatedDeliveryLabel } from "./deliveryEstimate";
import {
  buildOrderConfirmationEmail,
  buildOrderStatusEmail,
  confirmationBillRows,
  paymentMethodLabel,
} from "./orderEmail.templates";

const cutoff = {
  enabled: true,
  cutoffTime: "16:00",
  timezone: "America/Edmonton",
  weekdays: [1, 2, 3, 4, 5, 6],
  postalPrefixes: [] as string[],
};

describe("estimated delivery", () => {
  it("uses the order day before the cutoff and the next day after it", () => {
    const before = estimatedDeliveryLabel({
      placedAt: new Date("2026-10-28T21:00:00.000Z"),
      postalCode: "T2P 1A1",
      config: cutoff,
    });
    const after = estimatedDeliveryLabel({
      placedAt: new Date("2026-10-28T22:30:00.000Z"),
      postalCode: "T2P 1A1",
      config: cutoff,
    });
    expect(before).toMatch(/Oct 28/);
    expect(after).toMatch(/Oct 29/);
  });

  it("falls forward when same-day delivery is off", () => {
    const label = estimatedDeliveryLabel({
      placedAt: new Date("2026-10-28T21:00:00.000Z"),
      config: { ...cutoff, enabled: false },
      fallbackDays: 5,
    });
    expect(label).toMatch(/Nov 2/);
  });
});

describe("order confirmation email", () => {
  const email = buildOrderConfirmationEmail({
    orderNumber: "YD-1001",
    customerName: "Priya Shah",
    items: [
      { name: "Garlic <script>", variant: "750 g", quantity: 2, totalCents: 1058 },
    ],
    bill: {
      subtotalCents: 2000,
      productDiscountCents: 150,
      couponDiscountCents: 200,
      couponCode: "SAVE2",
      platformFeeCents: 99,
      handlingFeeCents: 50,
      deliveryFeeCents: 499,
      deliverySpeed: "superfast",
      taxCents: 80,
      taxJurisdiction: "AB",
      taxComponents: [{ type: "gst", taxAmountCents: 80 }],
      totalCents: 2727,
    },
    address: {
      fullName: "Priya Shah",
      phone: "403-555-0100",
      addressLine1: "123 Main St",
      city: "Calgary",
      state: "AB",
      postalCode: "T2P 1A1",
      country: "Canada",
    },
    estimatedDelivery: "Wed, Oct 28",
    paymentMethod: "square",
    cardLast4: "4242",
    cardBrand: "VISA",
    orderUrl: "https://www.yogisdepot.com/orders/abc",
  });

  it("includes the order, items, bill, address, delivery date, and card", () => {
    expect(email.subject).toContain("YD-1001");
    expect(email.text).toContain("Garlic <script>");
    expect(email.text).toContain("750 g");
    expect(email.text).toContain("× 2");
    expect(email.text).toContain("Product subtotal");
    expect(email.text).toContain("Platform fee");
    expect(email.text).toContain("Delivery fee (superfast)");
    expect(email.text).toContain("Small cart fee");
    expect(email.text).toContain("Tax (AB)");
    expect(email.text).toContain("Total paid");
    expect(email.text).toContain("123 Main St");
    expect(email.text).toContain("Calgary");
    expect(email.text).toContain("T2P 1A1");
    expect(email.text).toContain("Wed, Oct 28");
    expect(email.text).toContain("Visa ending in 4242");
    expect(email.text).toContain("You saved");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("https://www.yogisdepot.com/orders/abc");
  });

  it("does not invent card digits", () => {
    expect(paymentMethodLabel({ paymentMethod: "square" })).toBe("Card");
    expect(paymentMethodLabel({ paymentMethod: "square", cardLast4: "42", cardBrand: "VISA" })).toBe("Card");
    expect(paymentMethodLabel({ paymentMethod: "cod" })).toBe("Cash on delivery");
  });

  it("adds a small cart fee when the stored total is higher than the known lines", () => {
    const rows = confirmationBillRows({
      subtotalCents: 2000,
      couponDiscountCents: 200,
      platformFeeCents: 99,
      handlingFeeCents: 50,
      deliveryFeeCents: 499,
      taxCents: 80,
      totalCents: 2727,
    });
    const smallCart = rows.find((row) => row.label === "Small cart fee");
    expect(smallCart?.cents).toBe(199);
    const total = rows.find((row) => row.label === "Total paid");
    expect(total?.cents).toBe(2727);
  });
});

describe("order status email", () => {
  it("names the new status and includes a tracking link when one is safe", () => {
    const email = buildOrderStatusEmail({
      orderNumber: "YD-1001",
      status: "shipped",
      customerName: "Priya",
      orderUrl: "https://www.yogisdepot.com/orders/abc",
      trackingNumber: "1Z999",
      trackingUrl: "https://track.example/1Z999",
    });
    expect(email.subject).toContain("shipped");
    expect(email.text).toContain("1Z999");
    expect(email.text).toContain("https://track.example/1Z999");
    expect(email.html).toContain("Track shipment");
  });

  it("drops a tracking link that is not http(s)", () => {
    const email = buildOrderStatusEmail({
      orderNumber: "YD-1001",
      status: "out_for_delivery",
      orderUrl: "https://www.yogisdepot.com/orders/abc",
      trackingUrl: "javascript:alert(1)",
    });
    expect(email.html).not.toContain("javascript:");
    expect(email.text).not.toContain("Track shipment");
  });
});
