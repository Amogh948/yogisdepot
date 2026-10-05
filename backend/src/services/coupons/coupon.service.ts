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
};
