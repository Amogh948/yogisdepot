import mongoose, { Document, Model, Schema } from "mongoose";

export interface BrandDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<BrandDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String },
    logoUrl: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

brandSchema.index({ slug: 1 }, { unique: true });
brandSchema.index({ name: 1 });
brandSchema.index({ isActive: 1 });

brandSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const Brand: Model<BrandDocument> =
  mongoose.models.Brand || mongoose.model<BrandDocument>("Brand", brandSchema);
