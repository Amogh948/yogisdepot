import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface CartItem {
  /** Preferred purchasable unit. */
  skuId?: Types.ObjectId;
  /** Legacy dual-read during migration. */
  productId?: Types.ObjectId;
  quantity: number;
}

export interface CartDocument extends Document {
  userId: Types.ObjectId;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

const cartSchema = new Schema<CartDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        skuId: { type: Schema.Types.ObjectId, ref: "Sku" },
        productId: { type: Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
  },
  { timestamps: true },
);

cartSchema.index({ userId: 1 }, { unique: true });

cartSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const Cart: Model<CartDocument> =
  mongoose.models.Cart || mongoose.model<CartDocument>("Cart", cartSchema);
