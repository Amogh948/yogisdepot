import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const RESERVATION_STATUSES = ["reserved", "sold", "released", "expired"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface InventoryReservationDocument extends Document {
  skuId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  quantity: number;
  status: ReservationStatus;
  orderId?: Types.ObjectId;
  orderNumber?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryReservationSchema = new Schema<InventoryReservationDocument>(
  {
    skuId: { type: Schema.Types.ObjectId, ref: "Sku", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: RESERVATION_STATUSES, default: "reserved" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    orderNumber: { type: String },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

inventoryReservationSchema.index({ skuId: 1, status: 1 });
inventoryReservationSchema.index({ orderId: 1 });
inventoryReservationSchema.index({ status: 1, expiresAt: 1 });

export const InventoryReservation: Model<InventoryReservationDocument> =
  mongoose.models.InventoryReservation ||
  mongoose.model<InventoryReservationDocument>("InventoryReservation", inventoryReservationSchema);
