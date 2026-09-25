import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface CouponRedemptionDocument extends Document {
  couponId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  createdAt: Date;
}

const couponRedemptionSchema = new Schema<CouponRedemptionDocument>(
  {
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

couponRedemptionSchema.index({ couponId: 1, userId: 1 });

export const CouponRedemption: Model<CouponRedemptionDocument> =
  mongoose.models.CouponRedemption ||
  mongoose.model<CouponRedemptionDocument>("CouponRedemption", couponRedemptionSchema);
