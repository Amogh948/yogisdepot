import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface InventoryBatchDocument extends Document {
  skuId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  batchNumber: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  purchasePriceCents: number;
  quantityReceived: number;
  quantityAvailable: number;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryBatchSchema = new Schema<InventoryBatchDocument>(
  {
    skuId: { type: Schema.Types.ObjectId, ref: "Sku", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    batchNumber: { type: String, required: true, trim: true },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date },
    purchasePriceCents: { type: Number, required: true, min: 0, default: 0 },
    quantityReceived: { type: Number, required: true, min: 0 },
    quantityAvailable: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

inventoryBatchSchema.index({ skuId: 1, warehouseId: 1, batchNumber: 1 }, { unique: true });
inventoryBatchSchema.index({ expiryDate: 1 }); // FEFO-ready

inventoryBatchSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const InventoryBatch: Model<InventoryBatchDocument> =
  mongoose.models.InventoryBatch ||
  mongoose.model<InventoryBatchDocument>("InventoryBatch", inventoryBatchSchema);
