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

/** Fixed Taste India regions shown when a product is tagged for Taste India. */
export const TASTE_INDIA_REGIONS = [
  "north-india",
  "south-india",
  "west-india",
  "east-india",
  "northeast-india",
] as const;
export type TasteIndiaRegion = (typeof TASTE_INDIA_REGIONS)[number];

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

/** @deprecated Checkout tax uses CanadianTaxRate — not this flat rate. */
export const DEFAULT_TAX_RATE = 0;
/** CAD cents defaults for Canada market */
export const DEFAULT_DELIVERY_FEE_CENTS = 499; // $4.99
export const DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS = 7500; // $75.00
export const DEFAULT_PLATFORM_FEE_CENTS = 99; // $0.99
export const DEFAULT_HANDLING_FEE_CENTS = 49; // $0.49
export const DEFAULT_SMALL_CART_FEE_CENTS = 199; // $1.99
export const DEFAULT_SMALL_CART_THRESHOLD_CENTS = 2500; // $25.00
/** Legacy aliases (dollars) — prefer *_CENTS */
export const DEFAULT_SHIPPING_FEE = DEFAULT_DELIVERY_FEE_CENTS / 100;
export const FREE_SHIPPING_THRESHOLD = DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS / 100;
export const DEFAULT_CURRENCY = "CAD";
export const DEFAULT_WAREHOUSE_CODE = "YYZ-WH-01";
export const DEFAULT_COUNTRY = "Canada";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const CANCELLABLE_STATUSES: OrderStatus[] = ["pending", "confirmed"];
