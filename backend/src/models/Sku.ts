import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const SKU_STATUSES = ["active", "inactive", "discontinued"] as const;
export type SkuStatus = (typeof SKU_STATUSES)[number];

export interface SkuDocument extends Document {
  skuCode: string;
  productId: Types.ObjectId;
  variantId: string;
  vendorId: Types.ObjectId;
  barcode?: string;
  sellerSku?: string;
  taxCategoryId?: Types.ObjectId;
  status: SkuStatus;
  createdAt: Date;
  updatedAt: Date;
}

const skuSchema = new Schema<SkuDocument>(
  {
    skuCode: { type: String, required: true, uppercase: true, trim: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: String, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    barcode: { type: String, trim: true },
    sellerSku: { type: String, trim: true },
    taxCategoryId: { type: Schema.Types.ObjectId, ref: "TaxCategory" },
    status: { type: String, enum: SKU_STATUSES, default: "active" },
  },
  { timestamps: true },
);

skuSchema.index({ skuCode: 1 }, { unique: true });
skuSchema.index({ barcode: 1 }, { unique: true, sparse: true });
skuSchema.index({ productId: 1, status: 1 });
skuSchema.index({ vendorId: 1, status: 1 });
skuSchema.index({ variantId: 1 });

skuSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const Sku: Model<SkuDocument> =
  mongoose.models.Sku || mongoose.model<SkuDocument>("Sku", skuSchema);
