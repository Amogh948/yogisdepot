import { describe, expect, it } from "vitest";
import { fillDailySales, percentChange, provinceLabel, rollupBrandSales } from "./analytics.insights";

describe("sales insight helpers", () => {
  it("names Canadian provinces and keeps unknown places", () => {
    expect(provinceLabel("ab")).toBe("Alberta");
    expect(provinceLabel("ON")).toBe("Ontario");
    expect(provinceLabel("")).toBe("Unknown");
    expect(provinceLabel("Calgary region")).toBe("Calgary region");
  });

  it("compares a period only when the previous period had sales", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(20, 0)).toBeNull();
  });

  it("fills missing days in the sales chart", () => {
    const points = fillDailySales(
      [{ date: "2026-10-28", revenueCents: 500, orders: 1 }],
      3,
      new Date("2026-10-30T18:00:00.000Z"),
    );
    expect(points.map((point) => point.date)).toEqual(["2026-10-28", "2026-10-29", "2026-10-30"]);
    expect(points[0]?.revenueCents).toBe(500);
    expect(points[1]?.orders).toBe(0);
  });

  it("rolls product sales up to the brand customers actually bought", () => {
    const brands = rollupBrandSales(
      [
        { productId: "p1", name: "Sev", units: 4, revenueCents: 800, orderIds: ["o1", "o2"] },
        { productId: "p2", name: "Bhujia", units: 2, revenueCents: 400, orderIds: ["o2"] },
        { productId: "p3", name: "Rice", units: 1, revenueCents: 900, orderIds: ["o3"] },
      ],
      [
        { id: "p1", brandId: "b1" },
        { id: "p2", brandId: "b1" },
        { id: "p3", brand: "Sitara" },
      ],
      [{ id: "b1", name: "Haldiram" }],
    );
    expect(brands[0]).toMatchObject({ name: "Haldiram", units: 6, revenueCents: 1200, orders: 2 });
    expect(brands[1]).toMatchObject({ name: "Sitara", units: 1, orders: 1 });
  });
});
