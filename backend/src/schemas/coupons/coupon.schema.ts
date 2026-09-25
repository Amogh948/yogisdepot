import { z } from "zod";
import { DISCOUNT_TYPES } from "../../config/constants";

export const couponSchema = z.object({
  couponCode: z.string().min(3).max(24),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: z.number().min(0),
  minimumOrderValue: z.number().min(0).default(0),
  maximumDiscount: z.number().min(0).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  usageLimit: z.number().int().min(1).optional(),
  perUserLimit: z.number().int().min(1).default(1),
  isActive: z.boolean().optional(),
});

export const couponUpdateSchema = couponSchema.partial();

export const validateCouponSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().min(0).optional(),
});
