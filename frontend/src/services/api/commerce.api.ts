import type { Address, Cart, NotificationItem, Order, Pagination, Product, Review } from "../../types";
import { api, unwrap } from "./client";

export const cartApi = {
  get: () => unwrap<Cart>(api.get("/cart")),
  add: (productId: string, quantity: number) => unwrap<Cart>(api.post("/cart", { productId, quantity })),
  update: (productId: string, quantity: number) => unwrap<Cart>(api.patch(`/cart/${productId}`, { quantity })),
  remove: (productId: string) => unwrap<Cart>(api.delete(`/cart/${productId}`)),
  clear: () => unwrap<Cart>(api.delete("/cart")),
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

export const ordersApi = {
  quote: (coupon?: string) => unwrap<Record<string, unknown>>(api.get("/orders/quote", { params: { coupon } })),
  create: (payload: { addressId: string; paymentMethod: "cod" | "razorpay" | "mock_online"; couponCode?: string; notes?: string }) =>
    unwrap<{ order: Order; payment: { provider: string; reference: string; clientPayload?: Record<string, string | number> } }>(
      api.post("/orders", payload),
    ),
  verifyRazorpay: (
    orderId: string,
    payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  ) => unwrap<Order>(api.post(`/orders/${orderId}/pay/verify`, payload)),
  list: async (page = 1) => {
    const result = await unwrap<Order[]>(api.get("/orders", { params: { page } }));
    return { items: result.data, pagination: result.pagination as Pagination };
  },
  get: (id: string) => unwrap<Order>(api.get(`/orders/${id}`)),
  cancel: (id: string) => unwrap<Order>(api.post(`/orders/${id}/cancel`)),
};

export const reviewsApi = {
  forProduct: async (productId: string) => {
    const result = await unwrap<Review[]>(api.get(`/reviews/product/${productId}`));
    return result.data;
  },
  create: (payload: Record<string, unknown>) => unwrap<Review>(api.post("/reviews", payload)),
  mine: () => unwrap<Review[]>(api.get("/reviews/me")),
};

export const couponsApi = {
  validate: (code: string, subtotal: number) =>
    unwrap<{ code: string; amount: number }>(api.post("/coupons/validate", { code, subtotal })),
};

export const notificationsApi = {
  list: () => unwrap<NotificationItem[]>(api.get("/notifications")),
  markRead: (id: string) => unwrap<NotificationItem>(api.patch(`/notifications/${id}/read`)),
  markAll: () => unwrap<null>(api.patch("/notifications/read-all")),
};

export const vendorPublicApi = {
  apply: (payload: Record<string, unknown>) => unwrap<unknown>(api.post("/vendors/apply", payload)),
};
