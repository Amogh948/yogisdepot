import { z } from "zod";

export const createReviewSchema = z.object({
  productId: z.string().min(1),
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  comment: z.string().min(8).max(2000),
  images: z.array(z.string()).optional(),
});

export const reviewModerationSchema = z.object({
  isApproved: z.boolean(),
});
