import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  getSameDayStatus,
  resolveEstimatedDeliveryLabel,
  zonedParts,
} from "./sameDayDelivery";

const baseConfig = {
  enabled: true,
  cutoffTime: "16:00",
  timezone: "America/Edmonton",
  weekdays: [1, 2, 3, 4, 5, 6],
};

describe("getSameDayStatus", () => {
  it("counts down before cutoff on an applicable weekday", () => {
    // 2026-06-15 is a Monday in America/Edmonton
    const now = new Date("2026-06-15T18:00:00.000Z"); // ~12:00 MDT
    const local = zonedParts(now, "America/Edmonton");
    expect(local.weekday).toBe(1);
    expect(local.hour).toBeLessThan(16);

    const status = getSameDayStatus(baseConfig, now);
    expect(status.mode).toBe("same_day");
    expect(status.sameDayAvailable).toBe(true);
    expect(status.msRemaining).toBeGreaterThan(0);
    expect(formatCountdown(status)).toMatch(/\d/);
  });

  it("switches to next-day after cutoff", () => {
    const now = new Date("2026-06-15T23:00:00.000Z"); // ~17:00 MDT
    const status = getSameDayStatus(baseConfig, now);
    expect(status.mode).toBe("next_day");
    expect(status.sameDayAvailable).toBe(false);
    expect(status.msRemaining).toBe(0);
  });

  it("treats Sunday as next-day when only Mon–Sat apply", () => {
    // 2026-06-14 is a Sunday
    const now = new Date("2026-06-14T18:00:00.000Z");
    const status = getSameDayStatus(baseConfig, now);
    expect(zonedParts(now, "America/Edmonton").weekday).toBe(0);
    expect(status.mode).toBe("next_day");
    expect(status.sameDayAvailable).toBe(false);
  });

  it("respects postal prefix restrictions when provided", () => {
    const now = new Date("2026-06-15T18:00:00.000Z");
    const status = getSameDayStatus(
      { ...baseConfig, postalPrefixes: ["T2W"] },
      now,
      { postalCode: "T3A1B2" },
    );
    expect(status.mode).toBe("unavailable_area");
  });

  it("returns disabled when feature is off", () => {
    const status = getSameDayStatus({ ...baseConfig, enabled: false }, new Date());
    expect(status.mode).toBe("disabled");
    expect(status.enabled).toBe(false);
  });
});

describe("resolveEstimatedDeliveryLabel", () => {
  it("shows today in admin timezone while the timer is running", () => {
    const now = new Date("2026-06-15T18:00:00.000Z"); // Mon ~12:00 MDT
    const status = getSameDayStatus(baseConfig, now);
    const label = resolveEstimatedDeliveryLabel({
      status,
      timeZone: "America/Edmonton",
      now,
    });
    expect(label).toMatch(/Jun/);
    expect(label).toMatch(/15/);
  });

  it("shows the next calendar day after cutoff in admin timezone", () => {
    const now = new Date("2026-06-15T23:00:00.000Z"); // Mon ~17:00 MDT
    const status = getSameDayStatus(baseConfig, now);
    const label = resolveEstimatedDeliveryLabel({
      status,
      timeZone: "America/Edmonton",
      now,
    });
    expect(label).toMatch(/Jun/);
    expect(label).toMatch(/16/);
  });
});
