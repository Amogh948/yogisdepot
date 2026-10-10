import { describe, expect, it } from "vitest";
import { formatEstimatedDeliveryDate, returnPolicyLabel } from "./dates";

describe("dates helpers", () => {
  it("labels non-returnable when window is 0", () => {
    expect(returnPolicyLabel(0)).toBe("Non-returnable");
    expect(returnPolicyLabel(undefined)).toBe("Non-returnable");
  });

  it("labels return window days", () => {
    expect(returnPolicyLabel(1)).toBe("Returnable within 1 day");
    expect(returnPolicyLabel(7)).toBe("Returnable within 7 days");
  });

  it("formats estimated delivery from a local calendar date", () => {
    const from = new Date(2026, 9, 10); // Oct 10 2026 local
    const label = formatEstimatedDeliveryDate(5, from);
    expect(label).toMatch(/Oct/);
    expect(label).toMatch(/15/);
  });
});
