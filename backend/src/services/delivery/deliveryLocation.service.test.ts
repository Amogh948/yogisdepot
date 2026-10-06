import { describe, expect, it } from "vitest";
import { deliveryLocationService, normalizePostal, normalizeProvince } from "./deliveryLocation.service";

describe("deliveryLocationService matching", () => {
  it("normalizes Canadian provinces and postal codes", () => {
    expect(normalizeProvince("Alberta")).toBe("AB");
    expect(normalizeProvince("ab")).toBe("AB");
    expect(normalizePostal("t2w 1a1")).toBe("T2W1A1");
  });

  it("matches by postal prefix", () => {
    expect(
      deliveryLocationService.matchesLocation(
        { country: "Canada", state: "AB", city: "Calgary", postalCode: "T2W 1A1" },
        { country: "Canada", province: "AB", postalCodePrefix: "T2W" },
      ),
    ).toBe(true);
    expect(
      deliveryLocationService.matchesLocation(
        { country: "Canada", state: "AB", city: "Calgary", postalCode: "T2X 2B2" },
        { country: "Canada", province: "AB", postalCodePrefix: "T2W" },
      ),
    ).toBe(false);
  });

  it("rejects non-Canada addresses", () => {
    expect(
      deliveryLocationService.matchesLocation(
        { country: "USA", state: "AB", postalCode: "T2W 1A1" },
        { country: "Canada", province: "AB", postalCodePrefix: "T2W" },
      ),
    ).toBe(false);
  });
});
