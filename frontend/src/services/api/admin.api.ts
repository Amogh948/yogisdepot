import type { Coupon, Order, Pagination, Product, User, Vendor } from "../../types";
import { api, unwrap } from "./client";

export const adminApi = {
  analytics: () => unwrap<Record<string, unknown>>(api.get("/admin/analytics")),
  settings: () => unwrap<Record<string, unknown>>(api.get("/admin/settings")),
  updateSettings: (payload: Record<string, unknown>) => unwrap<Record<string, unknown>>(api.patch("/admin/settings", payload)),
  customers: async (search?: string) => {
    const result = await unwrap<User[]>(api.get("/admin/customers", { params: { search } }));
    return { items: result.data, pagination: result.pagination as Pagination };
  },
  setCustomerActive: (id: string, isActive: boolean) => unwrap<User>(api.patch(`/admin/customers/${id}`, { isActive })),
  vendors: async (params?: Record<string, string>) => {
    const result = await unwrap<Vendor[]>(api.get("/admin/vendors", { params }));
    return { items: result.data, pagination: result.pagination as Pagination };
  },
  vendor: (id: string) => unwrap<Vendor>(api.get(`/admin/vendors/${id}`)),
  vendorStatus: (id: string, payload: Record<string, unknown>) => unwrap<Vendor>(api.patch(`/admin/vendors/${id}/status`, payload)),
  categories: () => unwrap<unknown[]>(api.get("/admin/categories")),
  createCategory: (payload: Record<string, unknown>) => unwrap<unknown>(api.post("/categories", payload)),
  updateCategory: (id: string, payload: Record<string, unknown>) => unwrap<unknown>(api.put(`/categories/${id}`, payload)),
  products: async (params?: Record<string, unknown>) => {
    const result = await unwrap<Product[]>(api.get("/admin/products", { params }));
    return { items: result.data, pagination: result.pagination as Pagination };
  },
  createProduct: (payload: Record<string, unknown>) => unwrap<Product>(api.post("/admin/products", payload)),
  updateProduct: (id: string, payload: Record<string, unknown>) => unwrap<Product>(api.put(`/admin/products/${id}`, payload)),
  productStatus: (id: string, isActive: boolean) => unwrap<Product>(api.patch(`/admin/products/${id}/status`, { isActive })),
  orders: async (params?: Record<string, unknown>) => {
    const result = await unwrap<Order[]>(api.get("/admin/orders", { params }));
    return { items: result.data, pagination: result.pagination as Pagination };
  },
  order: (id: string) => unwrap<Order>(api.get(`/admin/orders/${id}`)),
  orderStatus: (id: string, status: string) => unwrap<Order>(api.patch(`/admin/orders/${id}/status`, { status })),
  coupons: async () => {
    const result = await unwrap<Coupon[]>(api.get("/admin/coupons"));
    return result.data;
  },
  createCoupon: (payload: Record<string, unknown>) => unwrap<Coupon>(api.post("/admin/coupons", payload)),
  reviews: async () => {
    const result = await unwrap<unknown[]>(api.get("/admin/reviews"));
    return result.data;
  },
  moderateReview: (id: string, isApproved: boolean) => unwrap<unknown>(api.patch(`/admin/reviews/${id}`, { isApproved })),
};

export const vendorApi = {
  me: () => unwrap<Vendor>(api.get("/vendors/me")),
  updateMe: (payload: Record<string, unknown>) => unwrap<Vendor>(api.patch("/vendors/me", payload)),
  analytics: () => unwrap<Record<string, unknown>>(api.get("/vendors/analytics")),
  products: async (params?: Record<string, unknown>) => {
    const result = await unwrap<Product[]>(api.get("/vendors/products", { params }));
    return { items: result.data, pagination: result.pagination as Pagination };
  },
  createProduct: (payload: Record<string, unknown>) => unwrap<Product>(api.post("/vendors/products", payload)),
  updateProduct: (id: string, payload: Record<string, unknown>) => unwrap<Product>(api.put(`/vendors/products/${id}`, payload)),
  productStatus: (id: string, isActive: boolean) => unwrap<Product>(api.patch(`/vendors/products/${id}/status`, { isActive })),
  adjustInventory: (id: string, payload: Record<string, unknown>) => unwrap<Product>(api.post(`/vendors/products/${id}/inventory`, payload)),
  orders: async () => {
    const result = await unwrap<Order[]>(api.get("/vendors/orders"));
    return { items: result.data, pagination: result.pagination as Pagination };
  },
  order: (id: string) => unwrap<Order>(api.get(`/vendors/orders/${id}`)),
  orderStatus: (id: string, status: string) => unwrap<Order>(api.patch(`/vendors/orders/${id}/status`, { status })),
};
