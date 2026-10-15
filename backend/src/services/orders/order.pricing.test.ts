import { describe, expect, it } from "vitest";
import { addCents, applyBps, clampNonNegativeCents } from "../../utils/money";
import { buildGroceryAwareTaxLines } from "../checkout/groceryTax.util";

/** Mirrors checkout total assembly using grocery-aware tax lines. */
function checkoutTotal(input: {
  groceryItemCents: number;
  nonGroceryItemCents: number;
  couponDiscountCents: number;
  scratchDiscountCents: number;
  deliveryFeeCents: number;
  platformFeeCents: number;
  handlingFeeCents: number;
  taxBps: number;
  freeShippingThresholdCents: number;
}) {
  const subtotalCents = input.groceryItemCents + input.nonGroceryItemCents;
  const afterDiscounts = clampNonNegativeCents(
    subtotalCents - input.couponDiscountCents - input.scratchDiscountCents,
  );
  const delivery =
    afterDiscounts >= input.freeShippingThresholdCents ? 0 : input.deliveryFeeCents;
  const lines = [
    ...(input.groceryItemCents
      ? [
          {
            skuId: "g1",
            productId: "pg",
            lineTotalCents: input.groceryItemCents,
            isGrocery: true as const,
          },
        ]
      : []),
    ...(input.nonGroceryItemCents
      ? [
          {
            skuId: "s1",
            productId: "ps",
            lineTotalCents: input.nonGroceryItemCents,
            isGrocery: false as const,
          },
        ]
      : []),
  ];
  const groceryTax = buildGroceryAwareTaxLines({
    lines,
    subtotalCents,
    discountPoolCents: input.couponDiscountCents + input.scratchDiscountCents,
    platformFeeCents: input.platformFeeCents,
    deliveryFeeCents: delivery,
  });
  const taxableAmountCents = groceryTax.taxLines.reduce((sum, line) => sum + line.taxableAmountCents, 0);
  const taxCents = applyBps(taxableAmountCents, input.taxBps);
  const totalCents = addCents(
    afterDiscounts,
    delivery,
    input.platformFeeCents,
    input.handlingFeeCents,
    taxCents,
  );
  return {
    afterDiscounts,
    delivery,
    taxableAmountCents,
    taxCents,
    totalCents,
    groceryOnlyCart: groceryTax.groceryOnlyCart,
    deliveryFeeTaxed: groceryTax.deliveryFeeTaxed,
  };
}

describe("checkout pricing cents assembly", () => {
  it("taxes taxable non-grocery items plus platform and delivery fees", () => {
    const result = checkoutTotal({
      groceryItemCents: 0,
      nonGroceryItemCents: 10000,
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
    expect(result.taxableAmountCents).toBe(9349);
    expect(result.taxCents).toBe(1215);
    expect(result.totalCents).toBe(9250 + 99 + 49 + 1215);
  });

  it("taxes only platform fee for grocery-only carts (delivery excluded from tax)", () => {
    const result = checkoutTotal({
      groceryItemCents: 5000,
      nonGroceryItemCents: 0,
      couponDiscountCents: 0,
      scratchDiscountCents: 0,
      deliveryFeeCents: 499,
      platformFeeCents: 99,
      handlingFeeCents: 0,
      taxBps: 1300,
      freeShippingThresholdCents: 7500,
    });
    expect(result.groceryOnlyCart).toBe(true);
    expect(result.deliveryFeeTaxed).toBe(false);
    expect(result.taxableAmountCents).toBe(99);
    expect(result.taxCents).toBe(13);
    expect(result.totalCents).toBe(5000 + 499 + 99 + 13);
  });

  it("taxes mixed carts: non-grocery subtotal + platform + delivery", () => {
    const result = checkoutTotal({
      groceryItemCents: 2000,
      nonGroceryItemCents: 3000,
      couponDiscountCents: 0,
      scratchDiscountCents: 0,
      deliveryFeeCents: 499,
      platformFeeCents: 99,
      handlingFeeCents: 0,
      taxBps: 1300,
      freeShippingThresholdCents: 7500,
    });
    expect(result.groceryOnlyCart).toBe(false);
    expect(result.deliveryFeeTaxed).toBe(true);
    expect(result.taxableAmountCents).toBe(3000 + 99 + 499);
    expect(result.taxCents).toBe(468);
  });
});
