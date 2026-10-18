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
  it("Rule 1: taxes only platform fee for non-taxable grocery-only carts", () => {
    const result = buildGroceryAwareTaxLines({
      lines: [
        {
          skuId: "g1",
          productId: "p1",
          lineTotalCents: 5000,
          isGrocery: true,
          taxability: "ZERO_RATED",
        },
      ],
      subtotalCents: 5000,
      discountPoolCents: 0,
      platformFeeCents: 99,
      deliveryFeeCents: 499,
    });
    expect(result.groceryOnlyCart).toBe(true);
    expect(result.hasTaxableGrocery).toBe(false);
    expect(result.deliveryFeeTaxed).toBe(false);
    expect(result.excludedGroceryAmountCents).toBe(5000);
    expect(result.taxLines).toEqual([{ skuId: "__platform_fee__", taxableAmountCents: 99 }]);
  });

  it("Rule 2: taxes taxable groceries + platform + delivery in grocery-only mix", () => {
    const result = buildGroceryAwareTaxLines({
      lines: [
        {
          skuId: "g-zero",
          productId: "p1",
          lineTotalCents: 2000,
          isGrocery: true,
          taxability: "ZERO_RATED",
        },
        {
          skuId: "g-tax",
          productId: "p2",
          lineTotalCents: 3000,
          taxCategoryId: "standard",
          isGrocery: true,
          taxability: "TAXABLE",
        },
      ],
      subtotalCents: 5000,
      discountPoolCents: 0,
      platformFeeCents: 99,
      deliveryFeeCents: 499,
    });
    expect(result.groceryOnlyCart).toBe(true);
    expect(result.hasTaxableGrocery).toBe(true);
    expect(result.deliveryFeeTaxed).toBe(true);
    expect(result.excludedGroceryAmountCents).toBe(2000);
    expect(result.taxLines).toEqual([
      { skuId: "g-tax", taxCategoryId: "standard", taxableAmountCents: 3000 },
      { skuId: "__platform_fee__", taxableAmountCents: 99 },
      { skuId: "__delivery_fee__", taxableAmountCents: 499 },
    ]);
  });

  it("Rule 3: taxes taxable groceries + other items + platform + delivery", () => {
    const result = buildGroceryAwareTaxLines({
      lines: [
        {
          skuId: "g-zero",
          productId: "p1",
          lineTotalCents: 1500,
          isGrocery: true,
          taxability: "ZERO_RATED",
        },
        {
          skuId: "g-tax",
          productId: "p2",
          lineTotalCents: 2000,
          taxCategoryId: "standard",
          isGrocery: true,
          taxability: "TAXABLE",
        },
        {
          skuId: "s1",
          productId: "p3",
          lineTotalCents: 3000,
          taxCategoryId: "standard",
          isGrocery: false,
          taxability: "TAXABLE",
        },
      ],
      subtotalCents: 6500,
      discountPoolCents: 0,
      platformFeeCents: 99,
      deliveryFeeCents: 499,
    });
    expect(result.groceryOnlyCart).toBe(false);
    expect(result.hasTaxableGrocery).toBe(true);
    expect(result.deliveryFeeTaxed).toBe(true);
    expect(result.excludedGroceryAmountCents).toBe(1500);
    expect(result.taxLines).toEqual([
      { skuId: "g-tax", taxCategoryId: "standard", taxableAmountCents: 2000 },
      { skuId: "s1", taxCategoryId: "standard", taxableAmountCents: 3000 },
      { skuId: "__platform_fee__", taxableAmountCents: 99 },
      { skuId: "__delivery_fee__", taxableAmountCents: 499 },
    ]);
  });

  it("excludes non-taxable groceries and taxes other items + platform + delivery", () => {
    const result = buildGroceryAwareTaxLines({
      lines: [
        {
          skuId: "g1",
          productId: "p1",
          lineTotalCents: 2000,
          isGrocery: true,
          taxability: "ZERO_RATED",
        },
        {
          skuId: "s1",
          productId: "p2",
          lineTotalCents: 3000,
          taxCategoryId: "standard",
          isGrocery: false,
          taxability: "TAXABLE",
        },
      ],
      subtotalCents: 5000,
      discountPoolCents: 0,
      platformFeeCents: 99,
      deliveryFeeCents: 499,
    });
    expect(result.groceryOnlyCart).toBe(false);
    expect(result.hasTaxableGrocery).toBe(false);
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

  it("treats groceries without taxability as non-taxable by default", () => {
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
    expect(result.hasTaxableGrocery).toBe(false);
    expect(result.deliveryFeeTaxed).toBe(false);
    expect(result.taxLines).toEqual([{ skuId: "__platform_fee__", taxableAmountCents: 99 }]);
  });
});
