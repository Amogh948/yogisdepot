import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { TASTE_INDIA_REGIONS, TasteIndiaRegion } from "../config/constants";

export const MERCHANDISING_PLACEMENTS = ["home", "offers", "gifts", "region", "festival"] as const;
export type MerchandisingPlacement = (typeof MERCHANDISING_PLACEMENTS)[number];

export interface MerchandisingCollectionDocument extends Document {
  name: string;
  slug: string;
  subtitle?: string;
  placement: MerchandisingPlacement;
  /** Taste India region this collection targets (when used for regional discovery). */
  tasteIndiaRegion?: TasteIndiaRegion;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  /** Inclusive schedule start. Null/undefined = no start limit. */
  startDate?: Date | null;
  /** Inclusive schedule end. Null/undefined = no end limit. */
  endDate?: Date | null;
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
    tasteIndiaRegion: { type: String, enum: TASTE_INDIA_REGIONS },
    image: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    productIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true },
);

merchandisingCollectionSchema.index({ slug: 1 }, { unique: true });
merchandisingCollectionSchema.index({ placement: 1, isActive: 1, sortOrder: 1 });
merchandisingCollectionSchema.index({ tasteIndiaRegion: 1, isActive: 1 });
merchandisingCollectionSchema.index({ startDate: 1, endDate: 1 });

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
