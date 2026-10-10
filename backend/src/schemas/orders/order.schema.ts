import { z } from "zod";
import { ORDER_STATUSES, PAYMENT_METHODS } from "../../config/constants";

export const createOrderSchema = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.enum(PAYMENT_METHODS),
  couponCode: z.string().max(40).optional(),
  scratchRewardId: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
});

export const squareVerifySchema = z.object({
  sourceId: z.string().min(1),
});

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});
