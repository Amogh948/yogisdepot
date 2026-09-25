import { describe, expect, it } from "vitest";

function computeTotals(subtotal: number, discount: number, taxRate: number, shippingFee: number, freeAt: number) {
  const taxable = Math.max(0, subtotal - discount);
  const shipping = taxable >= freeAt ? 0 : shippingFee;
  const tax = Math.round(taxable * taxRate * 100) / 100;
  const total = Math.round((taxable + shipping + tax) * 100) / 100;
  return { taxable, shipping, tax, total };
}

describe("order pricing", () => {
  it("computes tax and free shipping on the server", () => {
    const result = computeTotals(600, 50, 0.05, 40, 499);
    expect(result.shipping).toBe(0);
    expect(result.tax).toBe(27.5);
    expect(result.total).toBe(577.5);
  });

  it("applies shipping below the threshold", () => {
    const result = computeTotals(200, 0, 0.05, 40, 499);
    expect(result.shipping).toBe(40);
    expect(result.total).toBe(250);
  });
});
