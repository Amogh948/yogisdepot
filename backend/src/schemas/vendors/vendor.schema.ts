import { z } from "zod";
import { VENDOR_STATUSES } from "../../config/constants";

const addressSchema = z.object({
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(3),
  country: z.string().min(2).default("Canada"),
});

export const vendorApplySchema = z.object({
  businessName: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  email: z.string().email(),
  phone: z.string().min(8),
  address: addressSchema,
  taxInformation: z.string().optional(),
  bankInformation: z.string().optional(),
  logo: z.string().optional(),
  banner: z.string().optional(),
});

export const vendorUpdateSchema = vendorApplySchema.partial();

export const vendorStatusSchema = z.object({
  status: z.enum(VENDOR_STATUSES),
  rejectionReason: z.string().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
});

export const vendorListQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(VENDOR_STATUSES).optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  search: z.string().optional(),
});
