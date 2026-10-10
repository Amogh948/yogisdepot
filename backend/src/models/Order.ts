import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  ORDER_PAYMENT_METHODS,
  ORDER_STATUSES,
  OrderPaymentMethod,
  OrderStatus,
  PAYMENT_STATUSES,
  PaymentStatus,
} from "../config/constants";
import { CAD_CURRENCY } from "../utils/money";
import { CaTaxComponent } from "./CanadianTaxRate";

export interface OrderTaxComponentSnapshot {
  type: CaTaxComponent;
  rateBps: number;
  taxableAmountCents: number;
  taxAmountCents: number;
}

export interface OrderTaxSnapshot {
  jurisdiction: string;
  components: OrderTaxComponentSnapshot[];
  taxableAmountCents: number;
  totalTaxCents: number;
}

export interface OrderItemSnapshot {
  skuId?: Types.ObjectId;
  productId: Types.ObjectId;
  vendorId: Types.ObjectId;
  productName: string;
  variantName?: string;
  skuCode?: string;
  productImage?: string;
  quantity: number;
  mrpCents?: number;
  unitPriceCents: number;
  /** Legacy dollar fields for historical orders. */
  unitPrice?: number;
  discountCents?: number;
  taxCents?: number;
  finalUnitPriceCents?: number;
  totalAmountCents: number;
  totalPrice?: number;
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
  amountCents: number;
  /** Legacy */
  amount?: number;
}

export interface OrderDocument extends Document {
  orderNumber: string;
  customerId: Types.ObjectId;
  currency: typeof CAD_CURRENCY | string;
  items: OrderItemSnapshot[];
  subtotalCents: number;
  productDiscountCents: number;
  scratchDiscountCents: number;
  couponDiscountCents: number;
  deliveryFeeCents: number;
  platformFeeCents: number;
  handlingFeeCents: number;
  taxCents: number;
  totalCents: number;
  /** Legacy dollar mirrors for older clients / historical docs */
  subtotal?: number;
  discount?: number;
  shippingFee?: number;
  tax?: number;
  total?: number;
  taxSnapshot?: OrderTaxSnapshot;
  coupon?: CouponSnapshot;
  scratchRewardId?: Types.ObjectId;
  scratchRewardCode?: string;
  shippingAddress: ShippingAddressSnapshot;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  transactionId?: string;
  orderStatus: OrderStatus;
  notes?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const taxComponentSchema = new Schema<OrderTaxComponentSnapshot>(
  {
    type: { type: String, required: true },
    rateBps: { type: Number, required: true },
    taxableAmountCents: { type: Number, required: true },
    taxAmountCents: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDocument>(
  {
    orderNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    currency: { type: String, default: CAD_CURRENCY },
    items: [
      {
        skuId: { type: Schema.Types.ObjectId, ref: "Sku" },
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
        productName: { type: String, required: true },
        variantName: { type: String },
        skuCode: { type: String },
        productImage: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        mrpCents: { type: Number, min: 0 },
        unitPriceCents: { type: Number, min: 0 },
        unitPrice: { type: Number, min: 0 },
        discountCents: { type: Number, min: 0, default: 0 },
        taxCents: { type: Number, min: 0, default: 0 },
        finalUnitPriceCents: { type: Number, min: 0 },
        totalAmountCents: { type: Number, min: 0 },
        totalPrice: { type: Number, min: 0 },
        fulfillmentStatus: { type: String, enum: ORDER_STATUSES, default: "pending" },
      },
    ],
    subtotalCents: { type: Number, min: 0, default: 0 },
    productDiscountCents: { type: Number, min: 0, default: 0 },
    scratchDiscountCents: { type: Number, min: 0, default: 0 },
    couponDiscountCents: { type: Number, min: 0, default: 0 },
    deliveryFeeCents: { type: Number, min: 0, default: 0 },
    platformFeeCents: { type: Number, min: 0, default: 0 },
    handlingFeeCents: { type: Number, min: 0, default: 0 },
    taxCents: { type: Number, min: 0, default: 0 },
    totalCents: { type: Number, min: 0, default: 0 },
    subtotal: { type: Number, min: 0 },
    discount: { type: Number, min: 0, default: 0 },
    shippingFee: { type: Number, min: 0, default: 0 },
    tax: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0 },
    taxSnapshot: {
      jurisdiction: String,
      components: [taxComponentSchema],
      taxableAmountCents: Number,
      totalTaxCents: Number,
    },
    coupon: {
      code: String,
      discountType: { type: String, enum: ["percentage", "fixed"] },
      discountValue: Number,
      amountCents: Number,
      amount: Number,
    },
    scratchRewardId: { type: Schema.Types.ObjectId, ref: "UserScratchReward" },
    scratchRewardCode: { type: String },
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
    paymentMethod: { type: String, enum: ORDER_PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
    paymentReference: { type: String },
    transactionId: { type: String },
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
    // Compat: expose dollar fields from cents when missing
    if (json.total == null && typeof json.totalCents === "number") {
      json.total = (json.totalCents as number) / 100;
      json.subtotal = ((json.subtotalCents as number) || 0) / 100;
      json.discount =
        (((json.productDiscountCents as number) || 0) +
          ((json.scratchDiscountCents as number) || 0) +
          ((json.couponDiscountCents as number) || 0)) /
        100;
      json.shippingFee = ((json.deliveryFeeCents as number) || 0) / 100;
      json.tax = ((json.taxCents as number) || 0) / 100;
    }
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const Order: Model<OrderDocument> =
  mongoose.models.Order || mongoose.model<OrderDocument>("Order", orderSchema);
