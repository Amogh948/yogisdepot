import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface InventoryDocument extends Document {
  skuId: Types.ObjectId;
  skuCode: string;
  warehouseId: Types.ObjectId;
  warehouseCode: string;
  availableQuantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  updatedAt: Date;
  createdAt: Date;
}

const inventorySchema = new Schema<InventoryDocument>(
  {
    skuId: { type: Schema.Types.ObjectId, ref: "Sku", required: true },
    skuCode: { type: String, required: true, uppercase: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    warehouseCode: { type: String, required: true, uppercase: true },
    availableQuantity: { type: Number, required: true, min: 0, default: 0 },
    reservedQuantity: { type: Number, required: true, min: 0, default: 0 },
    damagedQuantity: { type: Number, required: true, min: 0, default: 0 },
    reorderLevel: { type: Number, default: 10, min: 0 },
    reorderQuantity: { type: Number, default: 50, min: 0 },
  },
  { timestamps: true },
);

inventorySchema.index({ skuId: 1, warehouseId: 1 }, { unique: true });
inventorySchema.index({ warehouseId: 1 });
inventorySchema.index({ skuId: 1 });

inventorySchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const Inventory: Model<InventoryDocument> =
  mongoose.models.Inventory || mongoose.model<InventoryDocument>("Inventory", inventorySchema);
