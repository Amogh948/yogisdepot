import { describe, expect, it } from "vitest";
import { buildGroceryAwareTaxLines, looksLikeGroceryCategory } from "./groceryTax.util";

describe("looksLikeGroceryCategory", () => {
  it("matches grocery slugs and names", () => {
    expect(looksLikeGroceryCategory({ slug: "grocery", name: "Grocery" })).toBe(true);
    expect(looksLikeGroceryCategory({ slug: "groceries", name: "Groceries" })).toBe(true);
    expect(looksLikeGroceryCategory({ slug: "snacks", name: "Snacks" })).toBe(false);
  });
});

describe("buildGroceryAwareTaxLines", () => {
  it("taxes only platform fee for grocery-only carts", () => {
    const result = buildGroceryAwareTaxLines({
      lines: [
        {
          skuId: "g1",
          productId: "p1",
          lineTotalCents: 5000,
          isGrocery: true,
        },
      ],
      subtotalCents: 5000,
      discountPoolCents: 0,
      platformFeeCents: 99,
      deliveryFeeCents: 499,
    });
    expect(result.groceryOnlyCart).toBe(true);
    expect(result.deliveryFeeTaxed).toBe(false);
    expect(result.excludedGroceryAmountCents).toBe(5000);
    expect(result.taxLines).toEqual([{ skuId: "__platform_fee__", taxableAmountCents: 99 }]);
  });

  it("taxes non-grocery items + platform + delivery for mixed carts", () => {
    const result = buildGroceryAwareTaxLines({
      lines: [
        {
          skuId: "g1",
          productId: "p1",
          lineTotalCents: 2000,
          isGrocery: true,
        },
        {
          skuId: "s1",
          productId: "p2",
          lineTotalCents: 3000,
          taxCategoryId: "standard",
          isGrocery: false,
        },
      ],
      subtotalCents: 5000,
      discountPoolCents: 0,
      platformFeeCents: 99,
      deliveryFeeCents: 499,
    });
    expect(result.groceryOnlyCart).toBe(false);
    expect(result.deliveryFeeTaxed).toBe(true);
    expect(result.excludedGroceryAmountCents).toBe(2000);
    expect(result.taxLines).toEqual([
      { skuId: "s1", taxCategoryId: "standard", taxableAmountCents: 3000 },
      { skuId: "__platform_fee__", taxableAmountCents: 99 },
      { skuId: "__delivery_fee__", taxableAmountCents: 499 },
    ]);
  });

  it("taxes items + platform + delivery when cart has no groceries", () => {
    const result = buildGroceryAwareTaxLines({
      lines: [
        {
          skuId: "s1",
          productId: "p2",
          lineTotalCents: 3000,
          isGrocery: false,
        },
      ],
      subtotalCents: 3000,
      discountPoolCents: 0,
      platformFeeCents: 99,
      deliveryFeeCents: 499,
    });
    expect(result.hasGrocery).toBe(false);
    expect(result.deliveryFeeTaxed).toBe(true);
    expect(result.taxLines.map((line) => line.skuId)).toEqual([
      "s1",
      "__platform_fee__",
      "__delivery_fee__",
    ]);
  });
});
