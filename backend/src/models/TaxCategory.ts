import mongoose, { Document, Model, Schema } from "mongoose";

export const TAXABILITIES = ["TAXABLE", "ZERO_RATED", "EXEMPT"] as const;
export type Taxability = (typeof TAXABILITIES)[number];

export interface TaxCategoryDocument extends Document {
  name: string;
  code: string;
  taxability: Taxability;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const taxCategorySchema = new Schema<TaxCategoryDocument>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    taxability: { type: String, enum: TAXABILITIES, default: "TAXABLE" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

taxCategorySchema.index({ code: 1 }, { unique: true });
taxCategorySchema.index({ isActive: 1 });

taxCategorySchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const TaxCategory: Model<TaxCategoryDocument> =
  mongoose.models.TaxCategory || mongoose.model<TaxCategoryDocument>("TaxCategory", taxCategorySchema);
