import { z } from "zod";
import {
  CANCELLATION_REASONS,
  DELIVERY_SPEEDS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
} from "../../config/constants";

export const createOrderSchema = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.enum(PAYMENT_METHODS),
  deliverySpeed: z.enum(DELIVERY_SPEEDS).optional().default("standard"),
  couponCode: z.string().max(40).optional(),
  scratchRewardId: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
});

export const squareVerifySchema = z.object({
  sourceId: z.string().min(1),
  /** Optional SCA token from legacy verifyBuyer; modern tokenize embeds verification in sourceId. */
  verificationToken: z.string().min(1).optional(),
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

export const cancellationFeedbackSchema = z.object({
  reason: z.enum(CANCELLATION_REASONS),
  betterDealDetails: z.string().trim().max(500).optional(),
});
