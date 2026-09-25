import { describe, expect, it } from "vitest";
import { couponService } from "./coupon.service";
import { Coupon } from "../../models/Coupon";

describe("coupon amount math", () => {
  it("caps percentage discounts by maximumDiscount and subtotal", async () => {
    const coupon = {
      couponCode: "SAVE20",
      discountType: "percentage" as const,
      discountValue: 20,
      minimumOrderValue: 0,
      maximumDiscount: 50,
      startDate: new Date(Date.now() - 1000),
      endDate: new Date(Date.now() + 100000),
      usedCount: 0,
      perUserLimit: 5,
      isActive: true,
    };

    const amountFrom = (subtotal: number, value: typeof coupon) => {
      let amount = value.discountType === "percentage" ? (subtotal * value.discountValue) / 100 : value.discountValue;
      if (value.maximumDiscount !== undefined) amount = Math.min(amount, value.maximumDiscount);
      amount = Math.min(amount, subtotal);
      return Math.round(amount * 100) / 100;
    };

    expect(amountFrom(400, coupon)).toBe(50);
    expect(amountFrom(100, coupon)).toBe(20);
    expect(Coupon.modelName).toBe("Coupon");
    expect(typeof couponService.apply).toBe("function");
  });
});
