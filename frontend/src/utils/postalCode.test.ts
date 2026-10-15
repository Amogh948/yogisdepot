import { describe, expect, it } from "vitest";
import { formatPostalCode, isValidPostalCode, postalCodeForSquare } from "./postalCode";

describe("postalCode", () => {
  it("formats Canadian postal codes as A1A 1A1", () => {
    expect(formatPostalCode("t2w1a1", "Canada")).toBe("T2W 1A1");
    expect(formatPostalCode("T2W-1A1", "CA")).toBe("T2W 1A1");
  });

  it("validates Canadian and US formats", () => {
    expect(isValidPostalCode("T2W 1A1", "Canada")).toBe(true);
    expect(isValidPostalCode("T2W1A1", "Canada")).toBe(true);
    expect(isValidPostalCode("12345", "Canada")).toBe(false);
    expect(isValidPostalCode("12345", "US")).toBe(true);
    expect(isValidPostalCode("12345-6789", "US")).toBe(true);
  });

  it("prepares Square postal prefills", () => {
    expect(postalCodeForSquare("t2w1a1", "Canada")).toBe("T2W 1A1");
  });
});
