import mongoose, { Document, Model, Schema } from "mongoose";
import { DEFAULT_SUPERFAST_DELIVERY_FEE_CENTS } from "../config/constants";
import { CA_PROVINCES, CaProvince } from "./CanadianTaxRate";

export interface DeliveryLocationDocument extends Document {
  /** Display label — usually the postal prefix (e.g. T2W). */
  name: string;
  country: string;
  province: CaProvince;
  city?: string;
  /** Canadian FSA / postal prefix, e.g. "T2W". Required for area matching. */
  postalCodePrefix: string;
  /** Neighbourhood / community names covered by this postal prefix. */
  areaNames: string[];
  /** Standard delivery fee for this area in CAD cents. */
  deliveryFeeCents: number;
  /** Superfast surcharge for this area in CAD cents (added on top of standard / free base). */
  superfastDeliveryFeeCents: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const deliveryLocationSchema = new Schema<DeliveryLocationDocument>(
  {
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: "Canada", trim: true },
    province: { type: String, enum: CA_PROVINCES, required: true, default: "AB" },
    city: { type: String, trim: true, default: "Calgary" },
    postalCodePrefix: { type: String, required: true, trim: true, uppercase: true },
    areaNames: { type: [String], default: [] },
    deliveryFeeCents: { type: Number, required: true, min: 0, default: 499 },
    superfastDeliveryFeeCents: {
      type: Number,
      required: true,
      min: 0,
      default: DEFAULT_SUPERFAST_DELIVERY_FEE_CENTS,
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

deliveryLocationSchema.index({ isActive: 1, postalCodePrefix: 1, sortOrder: 1 });
deliveryLocationSchema.index({ postalCodePrefix: 1 }, { unique: true });
deliveryLocationSchema.index({ country: 1, province: 1 });

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
