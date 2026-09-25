import { BadRequestError, NotFoundError } from "../../errors/AppError";
import { Coupon, CouponDocument } from "../../models/Coupon";
import { CouponRedemption } from "../../models/CouponRedemption";
import { buildPagination, parsePagination } from "../../utils/pagination";

export interface AppliedCoupon {
  coupon: CouponDocument;
  amount: number;
}

export const couponService = {
  async create(input: Partial<CouponDocument> & { couponCode: string }) {
    return Coupon.create({
      ...input,
      couponCode: input.couponCode.toUpperCase(),
    });
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

  async apply(code: string, userId: string, subtotal: number): Promise<AppliedCoupon> {
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
    if (subtotal < coupon.minimumOrderValue) {
      throw new BadRequestError(`Minimum order value is ₹${coupon.minimumOrderValue}`);
    }
    const userUses = await CouponRedemption.countDocuments({ couponId: coupon._id, userId });
    if (userUses >= coupon.perUserLimit) {
      throw new BadRequestError("You have already used this coupon");
    }
    let amount =
      coupon.discountType === "percentage" ? (subtotal * coupon.discountValue) / 100 : coupon.discountValue;
    if (coupon.maximumDiscount !== undefined) {
      amount = Math.min(amount, coupon.maximumDiscount);
    }
    amount = Math.min(amount, subtotal);
    amount = Math.round(amount * 100) / 100;
    return { coupon, amount };
  },
};
