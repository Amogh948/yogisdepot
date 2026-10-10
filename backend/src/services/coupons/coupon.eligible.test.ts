import { beforeEach, describe, expect, it, vi } from "vitest";

const couponsFixture = [
  {
    couponCode: "FLAT5",
    discountType: "fixed" as const,
    discountValue: 500,
    minimumOrderValueCents: 0,
    maximumDiscountCents: undefined,
    startDate: new Date("2020-01-01"),
    endDate: new Date("2030-01-01"),
    usageLimit: undefined,
    usedCount: 0,
    perUserLimit: 5,
    isActive: true,
    _id: "c1",
  },
  {
    couponCode: "SAVE10",
    discountType: "percentage" as const,
    discountValue: 10,
    minimumOrderValueCents: 0,
    maximumDiscountCents: 2000,
    startDate: new Date("2020-01-01"),
    endDate: new Date("2030-01-01"),
    usageLimit: undefined,
    usedCount: 0,
    perUserLimit: 5,
    isActive: true,
    _id: "c2",
  },
  {
    couponCode: "BIG",
    discountType: "percentage" as const,
    discountValue: 20,
    minimumOrderValueCents: 5000,
    maximumDiscountCents: undefined,
    startDate: new Date("2020-01-01"),
    endDate: new Date("2030-01-01"),
    usageLimit: undefined,
    usedCount: 0,
    perUserLimit: 1,
    isActive: true,
    _id: "c3",
  },
];

vi.mock("../../models/Coupon", () => ({
  Coupon: {
    find: vi.fn(() => ({
      sort: vi.fn(async () => couponsFixture.filter((c) => c.couponCode !== "BIG")),
    })),
    findOne: vi.fn(async ({ couponCode }: { couponCode: string }) =>
      couponsFixture.find((c) => c.couponCode === couponCode) || null,
    ),
  },
}));

vi.mock("../../models/CouponRedemption", () => ({
  CouponRedemption: { countDocuments: vi.fn(async () => 0) },
}));

import { Coupon } from "../../models/Coupon";
import { couponService } from "./coupon.service";

describe("couponService.listEligible", () => {
  beforeEach(() => {
    vi.mocked(Coupon.find).mockImplementation(
      () =>
        ({
          sort: vi.fn(async () => couponsFixture.filter((c) => c.couponCode !== "BIG")),
        }) as never,
    );
  });

  it("marks coupons applicable and sorts by discount amount", async () => {
    const rows = await couponService.listEligible("user1", 10000);
    expect(rows[0].code).toBe("SAVE10");
    expect(rows[0].discountAmountCents).toBe(1000);
    expect(rows[0].isApplicable).toBe(true);
    expect(rows[1].code).toBe("FLAT5");
    expect(rows[1].discountAmountCents).toBe(500);
  });

  it("explains minimum order shortfall", async () => {
    vi.mocked(Coupon.find).mockImplementation(
      () =>
        ({
          sort: vi.fn(async () => couponsFixture.filter((c) => c.couponCode === "BIG")),
        }) as never,
    );
    const rows = await couponService.listEligible("user1", 2000);
    expect(rows[0].isApplicable).toBe(false);
    expect(rows[0].reason).toMatch(/Add \$30\.00 more/i);
  });
});
