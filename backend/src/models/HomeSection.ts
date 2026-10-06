import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const HOME_SECTION_KEYS = ["bestsellers", "deals", "featured", "new_arrivals"] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export const HOME_SECTION_DEFAULTS: Record<
  HomeSectionKey,
  { title: string; subtitle?: string; sortOrder: number }
> = {
  bestsellers: { title: "Bestsellers", sortOrder: 1 },
  deals: { title: "Today's Deals", sortOrder: 2 },
  featured: { title: "Featured Picks", sortOrder: 3 },
  new_arrivals: { title: "New Arrivals", sortOrder: 4 },
};

export interface HomeSectionDocument extends Document {
  key: HomeSectionKey;
  title: string;
  subtitle?: string;
  productIds: Types.ObjectId[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const homeSectionSchema = new Schema<HomeSectionDocument>(
  {
    key: { type: String, enum: HOME_SECTION_KEYS, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    productIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

homeSectionSchema.index({ isActive: 1, sortOrder: 1 });

homeSectionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const HomeSection: Model<HomeSectionDocument> =
  mongoose.models.HomeSection || mongoose.model<HomeSectionDocument>("HomeSection", homeSectionSchema);
