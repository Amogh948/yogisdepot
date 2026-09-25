import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  ORDER_STATUSES,
  OrderStatus,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PaymentMethod,
  PaymentStatus,
} from "../config/constants";

export interface OrderItemSnapshot {
  productId: Types.ObjectId;
  vendorId: Types.ObjectId;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  fulfillmentStatus: OrderStatus;
}

export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark?: string;
}

export interface CouponSnapshot {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  amount: number;
}

export interface OrderDocument extends Document {
  orderNumber: string;
  customerId: Types.ObjectId;
  items: OrderItemSnapshot[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
  coupon?: CouponSnapshot;
  shippingAddress: ShippingAddressSnapshot;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  orderStatus: OrderStatus;
  notes?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<OrderDocument>(
  {
    orderNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
        productName: { type: String, required: true },
        productImage: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        fulfillmentStatus: { type: String, enum: ORDER_STATUSES, default: "pending" },
      },
    ],
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    shippingFee: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    coupon: {
      code: String,
      discountType: { type: String, enum: ["percentage", "fixed"] },
      discountValue: Number,
      amount: Number,
    },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      landmark: { type: String },
    },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
    paymentReference: { type: String },
    orderStatus: { type: String, enum: ORDER_STATUSES, default: "pending" },
    notes: { type: String },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ "items.vendorId": 1, createdAt: -1 });

orderSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const Order: Model<OrderDocument> =
  mongoose.models.Order || mongoose.model<OrderDocument>("Order", orderSchema);
