import { describe, expect, it } from "vitest";
import { addCents, applyBps, dollarsToCents, roundHalfUp } from "./money";

describe("money helpers", () => {
  it("rounds half-up", () => {
    expect(roundHalfUp(1.5)).toBe(2);
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(1.4)).toBe(1);
  });

  it("applies basis points without float tax math", () => {
    expect(applyBps(12999, 1300)).toBe(1690);
    expect(applyBps(10000, 500)).toBe(500);
  });

  it("converts dollars to cents", () => {
    expect(dollarsToCents(12.99)).toBe(1299);
    expect(dollarsToCents(1000)).toBe(100000);
  });

  it("adds cents", () => {
    expect(addCents(100, 50, 25)).toBe(175);
  });
});
