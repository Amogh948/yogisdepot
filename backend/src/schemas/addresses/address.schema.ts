import { z } from "zod";
import { ADDRESS_TYPES } from "../../config/constants";

export const addressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(3),
  country: z.string().min(2).default("India"),
  landmark: z.string().optional(),
  addressType: z.enum(ADDRESS_TYPES).default("home"),
  isDefault: z.boolean().optional(),
});

export const addressUpdateSchema = addressSchema.partial();
