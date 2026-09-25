export const APP_NAME = "Yogi's Depot";
export const API_PREFIX = "/api/v1";

export const USER_ROLES = ["admin", "vendor", "customer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const VENDOR_APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type VendorApprovalStatus = (typeof VENDOR_APPROVAL_STATUSES)[number];

export const VENDOR_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "suspended",
  "active",
  "inactive",
] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const ADDRESS_TYPES = ["home", "work", "other"] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["cod", "razorpay", "mock_online"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DISCOUNT_TYPES = ["percentage", "fixed"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const INVENTORY_TYPES = [
  "sale",
  "restock",
  "adjustment",
  "return",
  "damage",
] as const;
export type InventoryType = (typeof INVENTORY_TYPES)[number];

export const COOKIE_NAME = "yd_token";
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const DEFAULT_TAX_RATE = 0.05;
export const DEFAULT_SHIPPING_FEE = 40;
export const FREE_SHIPPING_THRESHOLD = 499;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const CANCELLABLE_STATUSES: OrderStatus[] = ["pending", "confirmed"];
