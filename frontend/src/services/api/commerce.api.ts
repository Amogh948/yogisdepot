import type { Address, Cart, NotificationItem, Order, Pagination, Product, Review } from "../../types";
import { api, unwrap } from "./client";

export const cartApi = {
  get: () => unwrap<Cart>(api.get("/cart")),
  add: (productIdOrSku: string, quantity: number, options?: { skuId?: string }) =>
    unwrap<Cart>(
      api.post("/cart", {
        quantity,
        ...(options?.skuId || productIdOrSku.startsWith("sku:")
          ? { skuId: options?.skuId || productIdOrSku.replace(/^sku:/, "") }
          : { productId: productIdOrSku }),
      }),
    ),
  update: (productId: string, quantity: number) => unwrap<Cart>(api.patch(`/cart/${productId}`, { quantity })),
  remove: (productId: string) => unwrap<Cart>(api.delete(`/cart/${productId}`)),
  clear: () => unwrap<Cart>(api.delete("/cart")),
};

export const scratchApi = {
  campaign: () => unwrap<{ id: string; name: string; description?: string } | null>(api.get("/scratch/campaign")),
  scratch: (campaignId?: string) => unwrap<Record<string, unknown>>(api.post("/scratch/scratch", { campaignId })),
  rewards: () => unwrap<Array<Record<string, unknown>>>(api.get("/scratch/rewards")),
};

export const wishlistApi = {
  list: () => unwrap<Product[]>(api.get("/wishlist")),
  add: (productId: string) => unwrap<Product[]>(api.post("/wishlist", { productId })),
  remove: (productId: string) => unwrap<Product[]>(api.delete(`/wishlist/${productId}`)),
};

export const addressApi = {
  list: () => unwrap<Address[]>(api.get("/addresses")),
  create: (payload: Partial<Address>) => unwrap<Address>(api.post("/addresses", payload)),
  update: (id: string, payload: Partial<Address>) => unwrap<Address>(api.put(`/addresses/${id}`, payload)),
  remove: (id: string) => unwrap<null>(api.delete(`/addresses/${id}`)),
};

export const deliveryApi = {
  locations: () =>
    unwrap<
      Array<{
        id?: string;
        _id?: string;
        name: string;
        province: string;
        city?: string;
        postalCodePrefix?: string;
      }>
    >(api.get("/delivery-locations")),
  check: (payload: { country: string; state: string; city?: string; postalCode?: string }) =>
    unwrap<{ deliverable: boolean; message: string | null }>(api.post("/delivery-locations/check", payload)),
};

export const ordersApi = {
  quote: (params?: {
    coupon?: string;
    addressId?: string;
    scratchRewardId?: string;
    deliverySpeed?: "standard" | "superfast";
  }) => unwrap<Record<string, unknown>>(api.get("/orders/quote", { params })),
  create: (payload: {
    addressId: string;
    paymentMethod: "cod" | "square" | "mock_online";
    deliverySpeed?: "standard" | "superfast";
    couponCode?: string;
    scratchRewardId?: string;
    notes?: string;
  }) =>
    unwrap<{ order: Order; payment: { provider: string; reference: string; clientPayload?: Record<string, string | number> } }>(
      api.post("/orders", payload),
    ),
  verifyPayment: (orderId: string, payload: { sourceId: string; verificationToken?: string }) =>
    unwrap<Order>(api.post(`/orders/${orderId}/pay/verify`, payload)),
  list: async (page = 1) => {
    const result = await unwrap<Order[]>(api.get("/orders", { params: { page } }));
    return { items: result.data, pagination: result.pagination as Pagination };
  },
  get: (id: string) => unwrap<Order>(api.get(`/orders/${id}`)),
  cancel: (id: string) => unwrap<Order>(api.post(`/orders/${id}/cancel`)),
  cancellationFeedback: (
    id: string,
    payload: {
      reason: "changed_my_mind" | "better_deal" | "ordered_by_mistake" | "delivery_too_long" | "other";
      betterDealDetails?: string;
    },
  ) => unwrap<Order>(api.post(`/orders/${id}/cancellation-feedback`, payload)),
};

export const reviewsApi = {
  forProduct: async (productId: string) => {
    const result = await unwrap<Review[]>(api.get(`/reviews/product/${productId}`));
    return result.data;
  },
  create: (payload: Record<string, unknown>) => unwrap<Review>(api.post("/reviews", payload)),
  mine: () => unwrap<Review[]>(api.get("/reviews/me")),
};

export type EligibleCoupon = {
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmountCents: number;
  isApplicable: boolean;
  reason: string | null;
  minOrderValueCents: number;
  maxDiscountAmountCents: number | null;
};

export const couponsApi = {
  validate: (code: string, subtotal: number) =>
    unwrap<{ code: string; amount: number; amountCents?: number }>(api.post("/coupons/validate", { code, subtotal })),
  eligible: () => unwrap<EligibleCoupon[]>(api.get("/coupons/eligible")),
};

export const notificationsApi = {
  list: () => unwrap<NotificationItem[]>(api.get("/notifications")),
  markRead: (id: string) => unwrap<NotificationItem>(api.patch(`/notifications/${id}/read`)),
  markAll: () => unwrap<null>(api.patch("/notifications/read-all")),
};

export const vendorPublicApi = {
  apply: (payload: Record<string, unknown>) => unwrap<unknown>(api.post("/vendors/apply", payload)),
};
