import mongoose, { Document, Model, Schema } from "mongoose";
import { CA_PROVINCES, CaProvince } from "./CanadianTaxRate";

export interface DeliveryLocationDocument extends Document {
  name: string;
  country: string;
  province: CaProvince;
  city?: string;
  /** Optional Canadian FSA / postal prefix, e.g. "M5V" or "M5V 0A1". */
  postalCodePrefix?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const deliveryLocationSchema = new Schema<DeliveryLocationDocument>(
  {
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: "Canada", trim: true },
    province: { type: String, enum: CA_PROVINCES, required: true },
    city: { type: String, trim: true },
    postalCodePrefix: { type: String, trim: true, uppercase: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

deliveryLocationSchema.index({ isActive: 1, province: 1, sortOrder: 1 });
deliveryLocationSchema.index({ country: 1, province: 1, city: 1 });

deliveryLocationSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const DeliveryLocation: Model<DeliveryLocationDocument> =
  mongoose.models.DeliveryLocation ||
  mongoose.model<DeliveryLocationDocument>("DeliveryLocation", deliveryLocationSchema);
