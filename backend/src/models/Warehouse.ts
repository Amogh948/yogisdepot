import mongoose, { Document, Model, Schema } from "mongoose";

export interface WarehouseDocument extends Document {
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const warehouseSchema = new Schema<WarehouseDocument>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, required: true, default: "Canada" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

warehouseSchema.index({ code: 1 }, { unique: true });
warehouseSchema.index({ isActive: 1 });

warehouseSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const Warehouse: Model<WarehouseDocument> =
  mongoose.models.Warehouse || mongoose.model<WarehouseDocument>("Warehouse", warehouseSchema);
