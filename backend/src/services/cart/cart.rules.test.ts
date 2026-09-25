import { describe, expect, it } from "vitest";

function nextQuantity(current: number, stock: number, delta: number): number | null {
  const next = current + delta;
  if (next < 1) return 0;
  if (next > stock) return null;
  return next;
}

describe("cart stock rules", () => {
  it("blocks quantity above stock", () => {
    expect(nextQuantity(2, 3, 2)).toBeNull();
    expect(nextQuantity(2, 5, 1)).toBe(3);
  });

  it("treats zero as removal", () => {
    expect(nextQuantity(1, 5, -1)).toBe(0);
  });
});
