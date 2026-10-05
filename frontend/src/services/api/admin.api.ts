import type { Coupon, Order, Pagination, Product, User, Vendor } from "../../types";
import { api, unwrap } from "./client";

export type AdminMerchandising = {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  subtitle?: string;
  placement: "home" | "offers" | "gifts";
  image?: string;
  sortOrder: number;
  isActive: boolean;
  productIds: string[];
  productCount?: number;
  products?: Array<{
    id: string;
    name: string;
    slug: string;
    thumbnail?: string;
    isActive?: boolean;
    price?: number;
  }>;
};

export type AdminDeliveryLocation = {
  id?: string;
  _id?: string;
  name: string;
  country: string;
  province: string;
  city?: string;
  postalCodePrefix?: string;
  isActive: boolean;
  sortOrder: number;
};

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
  createVendor: (payload: Record<string, unknown>) => unwrap<Vendor>(api.post("/admin/vendors", payload)),
  updateVendor: (id: string, payload: Record<string, unknown>) => unwrap<Vendor>(api.put(`/admin/vendors/${id}`, payload)),
  deleteVendor: (id: string) => unwrap<null>(api.delete(`/admin/vendors/${id}`)),
  vendorStatus: (id: string, payload: Record<string, unknown>) => unwrap<Vendor>(api.patch(`/admin/vendors/${id}/status`, payload)),
  categories: () => unwrap<unknown[]>(api.get("/admin/categories")),
  category: (id: string) => unwrap<unknown>(api.get(`/admin/categories/${id}`)),
  createCategory: (payload: Record<string, unknown>) => unwrap<unknown>(api.post("/admin/categories", payload)),
  updateCategory: (id: string, payload: Record<string, unknown>) => unwrap<unknown>(api.put(`/admin/categories/${id}`, payload)),
  deleteCategory: (id: string) => unwrap<null>(api.delete(`/admin/categories/${id}`)),
  products: async (params?: Record<string, unknown>) => {
    const result = await unwrap<Product[]>(api.get("/admin/products", { params }));
    return { items: result.data, pagination: result.pagination as Pagination };
  },
  productStack: (id: string) => unwrap<Record<string, unknown>>(api.get(`/admin/products/${id}`)),
  createProduct: (payload: Record<string, unknown>) => unwrap<Product>(api.post("/admin/products", payload)),
  createProductWizard: (payload: Record<string, unknown>) => unwrap<Product>(api.post("/admin/products/wizard", payload)),
  updateProductStack: (id: string, payload: Record<string, unknown>) =>
    unwrap<Record<string, unknown>>(api.put(`/admin/products/${id}/stack`, payload)),
  updateProduct: (id: string, payload: Record<string, unknown>) => unwrap<Product>(api.put(`/admin/products/${id}`, payload)),
  productStatus: (id: string, isActive: boolean) => unwrap<Product>(api.patch(`/admin/products/${id}/status`, { isActive })),
  deleteProduct: (id: string) => unwrap<Product>(api.delete(`/admin/products/${id}`)),
  brands: () => unwrap<unknown[]>(api.get("/admin/brands")),
  createBrand: (payload: Record<string, unknown>) => unwrap<unknown>(api.post("/admin/brands", payload)),
  taxCategories: () => unwrap<unknown[]>(api.get("/admin/tax-categories")),
  taxRates: () => unwrap<unknown[]>(api.get("/admin/tax-rates")),
  createTaxRate: (payload: Record<string, unknown>) => unwrap<unknown>(api.post("/admin/tax-rates", payload)),
  warehouses: () => unwrap<unknown[]>(api.get("/admin/warehouses")),
  skus: () => unwrap<unknown[]>(api.get("/admin/skus")),
  inventory: () => unwrap<unknown[]>(api.get("/admin/inventory")),
  scratchCampaigns: () => unwrap<unknown[]>(api.get("/admin/scratch-campaigns")),
  createScratchCampaign: (payload: Record<string, unknown>) => unwrap<unknown>(api.post("/admin/scratch-campaigns", payload)),
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
  merchandising: () => unwrap<AdminMerchandising[]>(api.get("/admin/merchandising")),
  merchandisingItem: (id: string) => unwrap<AdminMerchandising>(api.get(`/admin/merchandising/${id}`)),
  createMerchandising: (payload: Record<string, unknown>) =>
    unwrap<AdminMerchandising>(api.post("/admin/merchandising", payload)),
  updateMerchandising: (id: string, payload: Record<string, unknown>) =>
    unwrap<AdminMerchandising>(api.put(`/admin/merchandising/${id}`, payload)),
  deleteMerchandising: (id: string) => unwrap<null>(api.delete(`/admin/merchandising/${id}`)),
  productMerchandising: (productId: string) =>
    unwrap<Array<{ id?: string; _id?: string; name: string; placement: string; isActive: boolean }>>(
      api.get(`/admin/products/${productId}/merchandising`),
    ),
  setProductMerchandising: (productId: string, collectionIds: string[]) =>
    unwrap<unknown>(api.put(`/admin/products/${productId}/merchandising`, { collectionIds })),
  deliveryLocations: () => unwrap<AdminDeliveryLocation[]>(api.get("/admin/delivery-locations")),
  deliveryLocation: (id: string) => unwrap<AdminDeliveryLocation>(api.get(`/admin/delivery-locations/${id}`)),
  createDeliveryLocation: (payload: Record<string, unknown>) =>
    unwrap<AdminDeliveryLocation>(api.post("/admin/delivery-locations", payload)),
  updateDeliveryLocation: (id: string, payload: Record<string, unknown>) =>
    unwrap<AdminDeliveryLocation>(api.put(`/admin/delivery-locations/${id}`, payload)),
  deleteDeliveryLocation: (id: string) => unwrap<null>(api.delete(`/admin/delivery-locations/${id}`)),
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
