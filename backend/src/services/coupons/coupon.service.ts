import { BadRequestError, NotFoundError } from "../../errors/AppError";
import { Coupon, CouponDocument } from "../../models/Coupon";
import { CouponRedemption } from "../../models/CouponRedemption";
import { applyBps, clampNonNegativeCents, dollarsToCents } from "../../utils/money";
import { buildPagination, parsePagination } from "../../utils/pagination";

export interface AppliedCoupon {
  coupon: CouponDocument;
  /** @deprecated dollar amount */
  amount: number;
  amountCents: number;
}

function minOrderCents(coupon: CouponDocument): number {
  if (typeof coupon.minimumOrderValueCents === "number" && coupon.minimumOrderValueCents > 0) {
    return coupon.minimumOrderValueCents;
  }
  if (typeof coupon.minimumOrderValue === "number") {
    return dollarsToCents(coupon.minimumOrderValue);
  }
  return 0;
}

function maxDiscountCents(coupon: CouponDocument): number | undefined {
  if (typeof coupon.maximumDiscountCents === "number") return coupon.maximumDiscountCents;
  if (typeof coupon.maximumDiscount === "number") return dollarsToCents(coupon.maximumDiscount);
  return undefined;
}

export const couponService = {
  async create(input: Partial<CouponDocument> & { couponCode: string }) {
    const payload = {
      ...input,
      couponCode: input.couponCode.toUpperCase(),
    };
    if (payload.minimumOrderValue != null && payload.minimumOrderValueCents == null) {
      payload.minimumOrderValueCents = dollarsToCents(payload.minimumOrderValue);
    }
    if (payload.maximumDiscount != null && payload.maximumDiscountCents == null) {
      payload.maximumDiscountCents = dollarsToCents(payload.maximumDiscount);
    }
    // If discount is fixed and looks like dollars (< 1000 without cents field intent), keep as provided;
    // admin UI should send cents for fixed discounts going forward.
    return Coupon.create(payload);
  },

  async update(id: string, input: Partial<CouponDocument>) {
    const coupon = await Coupon.findByIdAndUpdate(
      id,
      input.couponCode ? { ...input, couponCode: input.couponCode.toUpperCase() } : input,
      { new: true },
    );
    if (!coupon) {
      throw new NotFoundError("Coupon not found");
    }
    return coupon;
  },

  async list(query: { page?: number; limit?: number }) {
    const { page, limit, skip } = parsePagination(query);
    const [data, total] = await Promise.all([
      Coupon.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Coupon.countDocuments(),
    ]);
    return { data, pagination: buildPagination(page, limit, total) };
  },

  async remove(id: string) {
    const coupon = await Coupon.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!coupon) {
      throw new NotFoundError("Coupon not found");
    }
    return coupon;
  },

  async applyCents(code: string, userId: string, subtotalCents: number): Promise<AppliedCoupon> {
    const coupon = await Coupon.findOne({ couponCode: code.toUpperCase() });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestError("Invalid coupon code");
    }
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new BadRequestError("This coupon is not currently valid");
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestError("This coupon has reached its usage limit");
    }
    const minCents = minOrderCents(coupon);
    if (subtotalCents < minCents) {
      throw new BadRequestError(`Minimum order value is CAD $${(minCents / 100).toFixed(2)}`);
    }
    const userUses = await CouponRedemption.countDocuments({ couponId: coupon._id, userId });
    if (userUses >= coupon.perUserLimit) {
      throw new BadRequestError("You have already used this coupon");
    }

    let amountCents: number;
    if (coupon.discountType === "percentage") {
      amountCents = applyBps(subtotalCents, coupon.discountValue * 100);
    } else {
      // Prefer treating fixed discountValue as cents when >= 100 or when maxDiscountCents is set;
      // migration converts legacy dollar fixed values to cents.
      amountCents = coupon.discountValue;
      if (coupon.discountValue > 0 && coupon.discountValue < 100 && !coupon.maximumDiscountCents && coupon.minimumOrderValue) {
        amountCents = dollarsToCents(coupon.discountValue);
      }
    }
    const maxCents = maxDiscountCents(coupon);
    if (maxCents !== undefined) {
      amountCents = Math.min(amountCents, maxCents);
    }
    amountCents = clampNonNegativeCents(Math.min(amountCents, subtotalCents));
    return { coupon, amountCents, amount: amountCents / 100 };
  },

  /** @deprecated Use applyCents */
  async apply(code: string, userId: string, subtotal: number): Promise<AppliedCoupon> {
    return this.applyCents(code, userId, dollarsToCents(subtotal));
  },

  /**
   * List active coupons for the current cart subtotal (selling cents).
   * Uses the same applyCents rules as checkout; does not mutate usage.
   */
  async listEligible(userId: string, subtotalCents: number) {
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).sort({ couponCode: 1 });

    const rows = await Promise.all(
      coupons.map(async (coupon) => {
        const base = {
          code: coupon.couponCode,
          description:
            coupon.discountType === "percentage"
              ? `${coupon.discountValue}% off`
              : `$${(coupon.discountValue / 100).toFixed(2)} off`,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minOrderValueCents: minOrderCents(coupon),
          maxDiscountAmountCents: maxDiscountCents(coupon) ?? null,
        };
        try {
          const applied = await this.applyCents(coupon.couponCode, userId, subtotalCents);
          return {
            ...base,
            discountAmountCents: applied.amountCents,
            isApplicable: true,
            reason: null as string | null,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Coupon not applicable";
          const minCents = minOrderCents(coupon);
          let reason = message;
          if (subtotalCents < minCents) {
            const need = ((minCents - subtotalCents) / 100).toFixed(2);
            reason = `Add $${need} more to use this coupon.`;
          }
          return {
            ...base,
            discountAmountCents: 0,
            isApplicable: false,
            reason,
          };
        }
      }),
    );

    return rows.sort((a, b) => {
      if (a.isApplicable !== b.isApplicable) return a.isApplicable ? -1 : 1;
      if (b.discountAmountCents !== a.discountAmountCents) {
        return b.discountAmountCents - a.discountAmountCents;
      }
      return a.code.localeCompare(b.code);
    });
  },
};
