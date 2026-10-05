import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  VENDOR_APPROVAL_STATUSES,
  VENDOR_STATUSES,
  VendorApprovalStatus,
  VendorStatus,
} from "../config/constants";

export interface VendorAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface VendorDocument extends Document {
  userId: Types.ObjectId;
  businessName: string;
  slug: string;
  description?: string;
  logo?: string;
  banner?: string;
  email: string;
  phone: string;
  address: VendorAddress;
  status: VendorStatus;
  approvalStatus: VendorApprovalStatus;
  taxInformation?: string;
  bankInformation?: string;
  commissionRate: number;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<VendorDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    description: { type: String },
    logo: { type: String },
    banner: { type: String },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    address: {
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true, default: "Canada" },
    },
    status: { type: String, enum: VENDOR_STATUSES, default: "pending" },
    approvalStatus: { type: String, enum: VENDOR_APPROVAL_STATUSES, default: "pending" },
    taxInformation: { type: String },
    bankInformation: { type: String },
    commissionRate: { type: Number, default: 10, min: 0, max: 100 },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

vendorSchema.index({ slug: 1 }, { unique: true });
vendorSchema.index({ approvalStatus: 1, status: 1 });
vendorSchema.index({ userId: 1 }, { unique: true });

vendorSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const Vendor: Model<VendorDocument> =
  mongoose.models.Vendor || mongoose.model<VendorDocument>("Vendor", vendorSchema);
