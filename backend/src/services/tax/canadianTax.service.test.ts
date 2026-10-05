import { beforeEach, describe, expect, it, vi } from "vitest";

const findRates = vi.fn();
const findCategories = vi.fn();

vi.mock("../../models/CanadianTaxRate", () => ({
  CA_PROVINCES: ["AB", "BC", "ON", "QC"],
  CanadianTaxRate: { find: () => ({ lean: findRates }) },
}));

vi.mock("../../models/TaxCategory", () => ({
  TaxCategory: { find: () => ({ lean: findCategories }) },
}));

import { canadianTaxService } from "./canadianTax.service";

describe("canadianTax.service", () => {
  beforeEach(() => {
    findRates.mockReset();
    findCategories.mockReset();
    findCategories.mockResolvedValue([]);
  });

  it("calculates ON HST from versioned rates", async () => {
    findRates.mockResolvedValue([{ component: "HST", rateBps: 1300, appliesToAllTaxable: true, taxCategoryIds: [] }]);
    const result = await canadianTaxService.calculate({
      shippingDestination: { country: "Canada", state: "ON" },
      transactionDate: new Date("2025-06-01"),
      lineItems: [{ skuId: "s1", taxableAmountCents: 12999 }],
    });
    expect(result.jurisdiction).toBe("CA-ON");
    expect(result.totalTaxCents).toBe(1690);
    expect(result.components[0].type).toBe("HST");
  });

  it("calculates AB GST only", async () => {
    findRates.mockResolvedValue([{ component: "GST", rateBps: 500, appliesToAllTaxable: true, taxCategoryIds: [] }]);
    const result = await canadianTaxService.calculate({
      shippingDestination: { country: "Canada", state: "Alberta" },
      transactionDate: new Date("2025-06-01"),
      lineItems: [{ skuId: "s1", taxableAmountCents: 10000 }],
    });
    expect(result.jurisdiction).toBe("CA-AB");
    expect(result.totalTaxCents).toBe(500);
  });

  it("skips zero-rated categories", async () => {
    findRates.mockResolvedValue([{ component: "HST", rateBps: 1300, appliesToAllTaxable: true, taxCategoryIds: [] }]);
    findCategories.mockResolvedValue([{ _id: "cat1", taxability: "ZERO_RATED" }]);
    const result = await canadianTaxService.calculate({
      shippingDestination: { country: "Canada", state: "ON" },
      transactionDate: new Date("2025-06-01"),
      lineItems: [{ skuId: "s1", taxCategoryId: "cat1", taxableAmountCents: 10000 }],
    });
    expect(result.totalTaxCents).toBe(0);
    expect(result.taxableAmountCents).toBe(0);
  });
});
