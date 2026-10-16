import { describe, expect, it } from "vitest";
import { MAX_ORDER_QUANTITY, UNLIMITED_ORDER_QUANTITY, maxOrderQuantity } from "./quantity";

describe("maxOrderQuantity", () => {
  it("caps at per-order max when unlimited is off", () => {
    expect(maxOrderQuantity({ stock: 200, unlimitedQuantity: false })).toBe(MAX_ORDER_QUANTITY);
    expect(maxOrderQuantity({ stock: 5, unlimitedQuantity: false })).toBe(5);
  });

  it("ignores stock when unlimited is on (including default/missing)", () => {
    expect(maxOrderQuantity({ stock: 0, unlimitedQuantity: true })).toBe(UNLIMITED_ORDER_QUANTITY);
    expect(maxOrderQuantity({ stock: 200, unlimitedQuantity: true })).toBe(UNLIMITED_ORDER_QUANTITY);
    expect(maxOrderQuantity({ stock: 5 })).toBe(UNLIMITED_ORDER_QUANTITY);
  });

  it("returns 1 when out of stock and limited", () => {
    expect(maxOrderQuantity({ stock: 0, unlimitedQuantity: false })).toBe(1);
  });
});
