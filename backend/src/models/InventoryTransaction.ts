import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { INVENTORY_TYPES, InventoryType } from "../config/constants";

export interface InventoryTransactionDocument extends Document {
  productId: Types.ObjectId;
  vendorId: Types.ObjectId;
  type: InventoryType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  createdAt: Date;
}

const inventoryTransactionSchema = new Schema<InventoryTransactionDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    type: { type: String, enum: INVENTORY_TYPES, required: true },
    quantity: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    reason: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

inventoryTransactionSchema.index({ productId: 1, createdAt: -1 });
inventoryTransactionSchema.index({ vendorId: 1, createdAt: -1 });

inventoryTransactionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const InventoryTransaction: Model<InventoryTransactionDocument> =
  mongoose.models.InventoryTransaction ||
  mongoose.model<InventoryTransactionDocument>("InventoryTransaction", inventoryTransactionSchema);
