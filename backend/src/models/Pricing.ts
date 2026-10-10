import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { CAD_CURRENCY } from "../utils/money";

export interface PricingDocument extends Document {
  skuId: Types.ObjectId;
  currency: typeof CAD_CURRENCY;
  mrpCents: number;
  costPriceCents: number;
  sellingPriceCents: number;
  discountAmountCents: number;
  discountPercentage: number;
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pricingSchema = new Schema<PricingDocument>(
  {
    skuId: { type: Schema.Types.ObjectId, ref: "Sku", required: true },
    currency: { type: String, default: CAD_CURRENCY, enum: [CAD_CURRENCY] },
    mrpCents: { type: Number, required: true, min: 0 },
    costPriceCents: { type: Number, required: true, min: 0, default: 0 },
    sellingPriceCents: { type: Number, required: true, min: 0 },
    discountAmountCents: { type: Number, default: 0, min: 0 },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    effectiveFrom: { type: Date, required: true, default: () => new Date() },
    effectiveUntil: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

pricingSchema.index({ skuId: 1, isActive: 1, effectiveFrom: -1 });
pricingSchema.pre("validate", function (next) {
  if (this.mrpCents < this.sellingPriceCents) {
    next(new Error("Original price (MRP) must be greater than or equal to the selling price"));
    return;
  }
  this.discountAmountCents = this.mrpCents - this.sellingPriceCents;
  this.discountPercentage =
    this.mrpCents > 0 ? Math.round((this.discountAmountCents / this.mrpCents) * 10000) / 100 : 0;
  next();
});

pricingSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const Pricing: Model<PricingDocument> =
  mongoose.models.Pricing || mongoose.model<PricingDocument>("Pricing", pricingSchema);
