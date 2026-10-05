import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const CA_TAX_COMPONENTS = ["GST", "HST", "PST", "QST"] as const;
export type CaTaxComponent = (typeof CA_TAX_COMPONENTS)[number];

export const CA_PROVINCES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;
export type CaProvince = (typeof CA_PROVINCES)[number];

export interface CanadianTaxRateDocument extends Document {
  province: CaProvince;
  component: CaTaxComponent;
  rateBps: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive: boolean;
  /** Empty = applies to all TAXABLE categories; otherwise only listed TaxCategory ids. */
  taxCategoryIds: Types.ObjectId[];
  appliesToAllTaxable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const canadianTaxRateSchema = new Schema<CanadianTaxRateDocument>(
  {
    province: { type: String, enum: CA_PROVINCES, required: true },
    component: { type: String, enum: CA_TAX_COMPONENTS, required: true },
    rateBps: { type: Number, required: true, min: 0, max: 10000 },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    taxCategoryIds: [{ type: Schema.Types.ObjectId, ref: "TaxCategory" }],
    appliesToAllTaxable: { type: Boolean, default: true },
  },
  { timestamps: true },
);

canadianTaxRateSchema.index({ province: 1, component: 1, effectiveFrom: 1 });
canadianTaxRateSchema.index({ isActive: 1, province: 1 });

canadianTaxRateSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const CanadianTaxRate: Model<CanadianTaxRateDocument> =
  mongoose.models.CanadianTaxRate ||
  mongoose.model<CanadianTaxRateDocument>("CanadianTaxRate", canadianTaxRateSchema);
