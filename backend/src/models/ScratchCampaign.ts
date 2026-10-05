import mongoose, { Document, Model, Schema } from "mongoose";

export const SCRATCH_CAMPAIGN_STATUSES = ["draft", "active", "ended"] as const;
export type ScratchCampaignStatus = (typeof SCRATCH_CAMPAIGN_STATUSES)[number];

export interface ScratchRewardDef {
  _id?: import("mongoose").Types.ObjectId;
  rewardType: "coupon_discount";
  discountType: "percentage" | "fixed";
  discountValue: number; // fixed = cents; percentage = percent points
  maximumDiscountCents?: number;
  minimumOrderValueCents: number;
  probability: number; // 0-1 share of probability mass
  usageLimit?: number;
  usageCount: number;
  label: string;
}

export interface ScratchCampaignDocument extends Document {
  name: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  rewards: ScratchRewardDef[];
  status: ScratchCampaignStatus;
  createdAt: Date;
  updatedAt: Date;
}

const scratchRewardSchema = new Schema<ScratchRewardDef>(
  {
    rewardType: { type: String, enum: ["coupon_discount"], default: "coupon_discount" },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maximumDiscountCents: { type: Number, min: 0 },
    minimumOrderValueCents: { type: Number, default: 0, min: 0 },
    probability: { type: Number, required: true, min: 0, max: 1 },
    usageLimit: { type: Number, min: 1 },
    usageCount: { type: Number, default: 0, min: 0 },
    label: { type: String, required: true },
  },
  { _id: true },
);

const scratchCampaignSchema = new Schema<ScratchCampaignDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    rewards: { type: [scratchRewardSchema], default: [] },
    status: { type: String, enum: SCRATCH_CAMPAIGN_STATUSES, default: "draft" },
  },
  { timestamps: true },
);

scratchCampaignSchema.index({ status: 1, startAt: 1, endAt: 1 });

scratchCampaignSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const ScratchCampaign: Model<ScratchCampaignDocument> =
  mongoose.models.ScratchCampaign ||
  mongoose.model<ScratchCampaignDocument>("ScratchCampaign", scratchCampaignSchema);
