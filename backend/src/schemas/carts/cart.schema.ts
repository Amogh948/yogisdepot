import { z } from "zod";
import { ABSOLUTE_MAX_ORDER_QUANTITY } from "../../config/constants";

export const cartItemSchema = z
  .object({
    skuId: z.string().min(1).optional(),
    productId: z.string().min(1).optional(),
    quantity: z.number().int().min(1).max(ABSOLUTE_MAX_ORDER_QUANTITY),
  })
  .refine((v) => Boolean(v.skuId || v.productId), { message: "skuId or productId is required" });

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(ABSOLUTE_MAX_ORDER_QUANTITY),
});
