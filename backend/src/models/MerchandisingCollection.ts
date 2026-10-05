import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const MERCHANDISING_PLACEMENTS = ["home", "offers", "gifts"] as const;
export type MerchandisingPlacement = (typeof MERCHANDISING_PLACEMENTS)[number];

export interface MerchandisingCollectionDocument extends Document {
  name: string;
  slug: string;
  subtitle?: string;
  placement: MerchandisingPlacement;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  productIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const merchandisingCollectionSchema = new Schema<MerchandisingCollectionDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    subtitle: { type: String, trim: true },
    placement: { type: String, enum: MERCHANDISING_PLACEMENTS, default: "home" },
    image: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    productIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true },
);

merchandisingCollectionSchema.index({ slug: 1 }, { unique: true });
merchandisingCollectionSchema.index({ placement: 1, isActive: 1, sortOrder: 1 });

merchandisingCollectionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const MerchandisingCollection: Model<MerchandisingCollectionDocument> =
  mongoose.models.MerchandisingCollection ||
  mongoose.model<MerchandisingCollectionDocument>("MerchandisingCollection", merchandisingCollectionSchema);
