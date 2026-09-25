import mongoose, { Document, Model, Schema } from "mongoose";
import { APP_NAME, DEFAULT_SHIPPING_FEE, DEFAULT_TAX_RATE, FREE_SHIPPING_THRESHOLD } from "../config/constants";

export interface PlatformSettingsDocument extends Document {
  siteName: string;
  taxRate: number;
  shippingFee: number;
  freeShippingThreshold: number;
  supportEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const platformSettingsSchema = new Schema<PlatformSettingsDocument>(
  {
    siteName: { type: String, default: APP_NAME },
    taxRate: { type: Number, default: DEFAULT_TAX_RATE, min: 0, max: 1 },
    shippingFee: { type: Number, default: DEFAULT_SHIPPING_FEE, min: 0 },
    freeShippingThreshold: { type: Number, default: FREE_SHIPPING_THRESHOLD, min: 0 },
    supportEmail: { type: String, default: "support@yogisdepot.local" },
  },
  { timestamps: true },
);

export const PlatformSettings: Model<PlatformSettingsDocument> =
  mongoose.models.PlatformSettings ||
  mongoose.model<PlatformSettingsDocument>("PlatformSettings", platformSettingsSchema);

export async function getPlatformSettings(): Promise<PlatformSettingsDocument> {
  const existing = await PlatformSettings.findOne();
  if (existing) {
    return existing;
  }
  return PlatformSettings.create({});
}
