import mongoose, { Document, Model, Schema } from "mongoose";
import {
  APP_NAME,
  DEFAULT_DELIVERY_FEE_CENTS,
  DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
  DEFAULT_HANDLING_FEE_CENTS,
  DEFAULT_PLATFORM_FEE_CENTS,
  DEFAULT_SMALL_CART_FEE_CENTS,
  DEFAULT_SMALL_CART_THRESHOLD_CENTS,
} from "../config/constants";

export interface PlatformSettingsDocument extends Document {
  siteName: string;
  /** @deprecated Not used for checkout tax — CanadianTaxRate + canadianTax.service */
  taxRate?: number;
  deliveryFeeCents: number;
  freeShippingThresholdCents: number;
  platformFeeCents: number;
  handlingFeeCents: number;
  smallCartFeeCents: number;
  smallCartThresholdCents: number;
  /** Legacy dollar mirrors */
  shippingFee?: number;
  freeShippingThreshold?: number;
  supportEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const platformSettingsSchema = new Schema<PlatformSettingsDocument>(
  {
    siteName: { type: String, default: APP_NAME },
    taxRate: { type: Number, min: 0, max: 1 },
    deliveryFeeCents: { type: Number, default: DEFAULT_DELIVERY_FEE_CENTS, min: 0 },
    freeShippingThresholdCents: {
      type: Number,
      default: DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
      min: 0,
    },
    platformFeeCents: { type: Number, default: DEFAULT_PLATFORM_FEE_CENTS, min: 0 },
    handlingFeeCents: { type: Number, default: DEFAULT_HANDLING_FEE_CENTS, min: 0 },
    smallCartFeeCents: { type: Number, default: DEFAULT_SMALL_CART_FEE_CENTS, min: 0 },
    smallCartThresholdCents: {
      type: Number,
      default: DEFAULT_SMALL_CART_THRESHOLD_CENTS,
      min: 0,
    },
    shippingFee: { type: Number, min: 0 },
    freeShippingThreshold: { type: Number, min: 0 },
    supportEmail: { type: String, default: "support@yogisdepot.com" },
  },
  { timestamps: true },
);

export const PlatformSettings: Model<PlatformSettingsDocument> =
  mongoose.models.PlatformSettings ||
  mongoose.model<PlatformSettingsDocument>("PlatformSettings", platformSettingsSchema);

export async function getPlatformSettings(): Promise<PlatformSettingsDocument> {
  let existing = await PlatformSettings.findOne();
  if (!existing) {
    existing = await PlatformSettings.create({});
  }
  // Backfill cents from legacy dollar fields once
  let dirty = false;
  if (
    (existing.deliveryFeeCents == null || existing.deliveryFeeCents === DEFAULT_DELIVERY_FEE_CENTS) &&
    typeof existing.shippingFee === "number"
  ) {
    existing.deliveryFeeCents = Math.round(existing.shippingFee * 100);
    dirty = true;
  }
  if (
    (existing.freeShippingThresholdCents == null ||
      existing.freeShippingThresholdCents === DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS) &&
    typeof existing.freeShippingThreshold === "number"
  ) {
    existing.freeShippingThresholdCents = Math.round(existing.freeShippingThreshold * 100);
    dirty = true;
  }
  if (dirty) await existing.save();
  return existing;
}
