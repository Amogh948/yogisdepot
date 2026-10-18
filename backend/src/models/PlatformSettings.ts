import mongoose, { Document, Model, Schema } from "mongoose";
import {
  APP_NAME,
  DEFAULT_DELIVERY_FEE_CENTS,
  DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
  DEFAULT_HANDLING_FEE_CENTS,
  DEFAULT_PLATFORM_FEE_CENTS,
  DEFAULT_SAME_DAY_CUTOFF_TIME,
  DEFAULT_SAME_DAY_DELIVERY_ENABLED,
  DEFAULT_SAME_DAY_TIMEZONE,
  DEFAULT_SAME_DAY_WEEKDAYS,
  DEFAULT_SMALL_CART_FEE_CENTS,
  DEFAULT_SMALL_CART_THRESHOLD_CENTS,
  DEFAULT_LOW_STOCK_DISPLAY_THRESHOLD,
  DEFAULT_IN_STOCK_DISPLAY_THRESHOLD,
  DEFAULT_SUPERFAST_DELIVERY_FEE_CENTS,
} from "../config/constants";

export interface PlatformSettingsDocument extends Document {
  siteName: string;
  /** Display / checkout currency code (ISO 4217). Prices remain stored in minor units. */
  currency: string;
  /** @deprecated Not used for checkout tax — CanadianTaxRate + canadianTax.service */
  taxRate?: number;
  deliveryFeeCents: number;
  /** Extra amount added on top of the standard delivery fee for Superfast Delivery. */
  superfastDeliveryFeeCents: number;
  freeShippingThresholdCents: number;
  platformFeeCents: number;
  handlingFeeCents: number;
  smallCartFeeCents: number;
  smallCartThresholdCents: number;
  /** When tracked stock is 1..this, PDP shows yellow "{n} available". */
  lowStockDisplayThreshold: number;
  /** When tracked stock is above this, PDP shows green "In stock". */
  inStockDisplayThreshold: number;
  /** Same-day delivery promise (cutoff timer). Independent of Superfast surcharge. */
  sameDayDeliveryEnabled: boolean;
  /** Local cutoff time HH:mm (24h) in sameDayTimezone. */
  sameDayCutoffTime: string;
  sameDayTimezone: string;
  /** Weekdays (0=Sun…6=Sat) when same-day delivery is offered. */
  sameDayWeekdays: number[];
  /** Optional postal prefixes (e.g. T2W). Empty = all areas. */
  sameDayPostalPrefixes: string[];
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
    currency: { type: String, default: "CAD", uppercase: true, trim: true },
    taxRate: { type: Number, min: 0, max: 1 },
    deliveryFeeCents: { type: Number, default: DEFAULT_DELIVERY_FEE_CENTS, min: 0 },
    superfastDeliveryFeeCents: {
      type: Number,
      default: DEFAULT_SUPERFAST_DELIVERY_FEE_CENTS,
      min: 0,
    },
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
    lowStockDisplayThreshold: {
      type: Number,
      default: DEFAULT_LOW_STOCK_DISPLAY_THRESHOLD,
      min: 0,
    },
    inStockDisplayThreshold: {
      type: Number,
      default: DEFAULT_IN_STOCK_DISPLAY_THRESHOLD,
      min: 0,
    },
    sameDayDeliveryEnabled: { type: Boolean, default: DEFAULT_SAME_DAY_DELIVERY_ENABLED },
    sameDayCutoffTime: { type: String, default: DEFAULT_SAME_DAY_CUTOFF_TIME, trim: true },
    sameDayTimezone: { type: String, default: DEFAULT_SAME_DAY_TIMEZONE, trim: true },
    sameDayWeekdays: {
      type: [Number],
      default: () => [...DEFAULT_SAME_DAY_WEEKDAYS],
    },
    sameDayPostalPrefixes: { type: [String], default: [] },
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
  // Backfill cents from legacy dollar fields only when cents were never set
  let dirty = false;
  if (existing.deliveryFeeCents == null && typeof existing.shippingFee === "number") {
    existing.deliveryFeeCents = Math.round(existing.shippingFee * 100);
    dirty = true;
  }
  if (existing.freeShippingThresholdCents == null && typeof existing.freeShippingThreshold === "number") {
    existing.freeShippingThresholdCents = Math.round(existing.freeShippingThreshold * 100);
    dirty = true;
  }
  if (dirty) await existing.save();
  return existing;
}
