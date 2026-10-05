import { describe, expect, it } from "vitest";
import { deliveryLocationService, normalizePostal, normalizeProvince } from "./deliveryLocation.service";

describe("deliveryLocationService matching", () => {
  it("normalizes Canadian provinces and postal codes", () => {
    expect(normalizeProvince("Ontario")).toBe("ON");
    expect(normalizeProvince("on")).toBe("ON");
    expect(normalizePostal("m5v 0a1")).toBe("M5V0A1");
  });

  it("matches province-wide locations", () => {
    expect(
      deliveryLocationService.matchesLocation(
        { country: "Canada", state: "ON", city: "Toronto", postalCode: "M5V 0A1" },
        { country: "Canada", province: "ON" },
      ),
    ).toBe(true);
    expect(
      deliveryLocationService.matchesLocation(
        { country: "Canada", state: "BC", city: "Vancouver", postalCode: "V6B 1A1" },
        { country: "Canada", province: "ON" },
      ),
    ).toBe(false);
  });

  it("matches city and postal prefix when configured", () => {
    expect(
      deliveryLocationService.matchesLocation(
        { country: "Canada", state: "ON", city: "Toronto", postalCode: "M5V 0A1" },
        { country: "Canada", province: "ON", city: "Toronto", postalCodePrefix: "M5V" },
      ),
    ).toBe(true);
    expect(
      deliveryLocationService.matchesLocation(
        { country: "Canada", state: "ON", city: "Mississauga", postalCode: "L5B 1A1" },
        { country: "Canada", province: "ON", city: "Toronto" },
      ),
    ).toBe(false);
  });
});
