import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const USER_SCRATCH_STATUSES = ["issued", "redeemed", "expired"] as const;
export type UserScratchStatus = (typeof USER_SCRATCH_STATUSES)[number];

export interface UserScratchRewardDocument extends Document {
  userId: Types.ObjectId;
  campaignId: Types.ObjectId;
  rewardId: Types.ObjectId;
  code: string;
  label: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maximumDiscountCents?: number;
  minimumOrderValueCents: number;
  status: UserScratchStatus;
  expiresAt: Date;
  redeemedAt?: Date;
  redeemedOrderId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userScratchRewardSchema = new Schema<UserScratchRewardDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "ScratchCampaign", required: true },
    rewardId: { type: Schema.Types.ObjectId, required: true },
    code: { type: String, required: true, uppercase: true },
    label: { type: String, required: true },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maximumDiscountCents: { type: Number, min: 0 },
    minimumOrderValueCents: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: USER_SCRATCH_STATUSES, default: "issued" },
    expiresAt: { type: Date, required: true },
    redeemedAt: { type: Date },
    redeemedOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true },
);

userScratchRewardSchema.index({ code: 1 }, { unique: true });
userScratchRewardSchema.index({ userId: 1, status: 1, expiresAt: 1 });
userScratchRewardSchema.index({ userId: 1, campaignId: 1 }, { unique: true });

userScratchRewardSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const UserScratchReward: Model<UserScratchRewardDocument> =
  mongoose.models.UserScratchReward ||
  mongoose.model<UserScratchRewardDocument>("UserScratchReward", userScratchRewardSchema);
