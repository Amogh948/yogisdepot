import { describe, expect, it } from "vitest";
import { addCents, applyBps, clampNonNegativeCents } from "../../utils/money";

/** Mirrors checkoutPricing fee + tax assembly in cents. */
function checkoutTotal(input: {
  subtotalCents: number;
  couponDiscountCents: number;
  scratchDiscountCents: number;
  deliveryFeeCents: number;
  platformFeeCents: number;
  handlingFeeCents: number;
  taxBps: number;
  freeShippingThresholdCents: number;
}) {
  const afterDiscounts = clampNonNegativeCents(
    input.subtotalCents - input.couponDiscountCents - input.scratchDiscountCents,
  );
  const delivery =
    afterDiscounts >= input.freeShippingThresholdCents ? 0 : input.deliveryFeeCents;
  const taxCents = applyBps(afterDiscounts, input.taxBps);
  const totalCents = addCents(
    afterDiscounts,
    delivery,
    input.platformFeeCents,
    input.handlingFeeCents,
    taxCents,
  );
  return { afterDiscounts, delivery, taxCents, totalCents };
}

describe("checkout pricing cents assembly", () => {
  it("applies product/coupon/scratch/fees/tax in CAD cents", () => {
    const result = checkoutTotal({
      subtotalCents: 10000,
      couponDiscountCents: 500,
      scratchDiscountCents: 250,
      deliveryFeeCents: 499,
      platformFeeCents: 99,
      handlingFeeCents: 49,
      taxBps: 1300,
      freeShippingThresholdCents: 7500,
    });
    expect(result.afterDiscounts).toBe(9250);
    expect(result.delivery).toBe(0);
    expect(result.taxCents).toBe(1203);
    expect(result.totalCents).toBe(9250 + 99 + 49 + 1203);
  });

  it("charges delivery below free-shipping threshold", () => {
    const result = checkoutTotal({
      subtotalCents: 2000,
      couponDiscountCents: 0,
      scratchDiscountCents: 0,
      deliveryFeeCents: 499,
      platformFeeCents: 0,
      handlingFeeCents: 0,
      taxBps: 500,
      freeShippingThresholdCents: 7500,
    });
    expect(result.delivery).toBe(499);
    expect(result.taxCents).toBe(100);
    expect(result.totalCents).toBe(2000 + 499 + 100);
  });
});
