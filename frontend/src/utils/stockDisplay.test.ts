import { describe, expect, it } from "vitest";
import { resolveStockDisplay } from "./stockDisplay";

describe("resolveStockDisplay", () => {
  it("shows In stock for unlimited products", () => {
    expect(resolveStockDisplay({ unlimitedQuantity: true, stock: 0 })).toEqual({
      label: "In stock",
      tone: "green",
      inStock: true,
    });
  });

  it("shows Currently Out of stock when tracked stock is 0", () => {
    expect(resolveStockDisplay({ unlimitedQuantity: false, stock: 0 })).toEqual({
      label: "Currently Out of stock",
      tone: "red",
      inStock: false,
    });
  });

  it("shows yellow count at or below low threshold", () => {
    expect(
      resolveStockDisplay({
        unlimitedQuantity: false,
        stock: 3,
        lowStockDisplayThreshold: 5,
        inStockDisplayThreshold: 10,
      }),
    ).toEqual({ label: "3 available", tone: "yellow", inStock: true });
  });

  it("shows In stock above in-stock threshold", () => {
    expect(
      resolveStockDisplay({
        unlimitedQuantity: false,
        stock: 11,
        lowStockDisplayThreshold: 5,
        inStockDisplayThreshold: 10,
      }),
    ).toEqual({ label: "In stock", tone: "green", inStock: true });
  });

  it("shows green count between thresholds", () => {
    expect(
      resolveStockDisplay({
        unlimitedQuantity: false,
        stock: 8,
        lowStockDisplayThreshold: 5,
        inStockDisplayThreshold: 10,
      }),
    ).toEqual({ label: "8 available", tone: "green", inStock: true });
  });
});
