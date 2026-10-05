import mongoose, { Document, Model, Schema } from "mongoose";
import { DISCOUNT_TYPES, DiscountType } from "../config/constants";

export interface CouponDocument extends Document {
  couponCode: string;
  discountType: DiscountType;
  /** fixed = cents; percentage = percent points */
  discountValue: number;
  minimumOrderValueCents: number;
  maximumDiscountCents?: number;
  /** Legacy dollar fields */
  minimumOrderValue?: number;
  maximumDiscount?: number;
  startDate: Date;
  endDate: Date;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<CouponDocument>(
  {
    couponCode: { type: String, required: true, uppercase: true, trim: true },
    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minimumOrderValueCents: { type: Number, default: 0, min: 0 },
    maximumDiscountCents: { type: Number, min: 0 },
    minimumOrderValue: { type: Number, default: 0, min: 0 },
    maximumDiscount: { type: Number, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 1, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

couponSchema.index({ couponCode: 1 }, { unique: true });
couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

couponSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const Coupon: Model<CouponDocument> =
  mongoose.models.Coupon || mongoose.model<CouponDocument>("Coupon", couponSchema);
