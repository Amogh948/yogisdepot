export type UserRole = "admin" | "vendor" | "customer";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  vendorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  pagination?: Pagination;
}

export interface Category {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  isActive: boolean;
  children?: Category[];
}

export interface VendorSummary {
  id?: string;
  _id?: string;
  businessName: string;
  slug: string;
  logo?: string;
}

export interface Product {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  sku: string;
  vendorId: VendorSummary | string;
  categoryId: { name: string; slug: string } | string;
  brand?: string;
  images: string[];
  thumbnail?: string;
  price: number;
  compareAtPrice?: number;
  discount: number;
  stock: number;
  lowStockThreshold: number;
  unit: string;
  ingredients?: string;
  allergens?: string[];
  nutritionInformation?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
  };
  tags: string[];
  isVegetarian: boolean;
  isVegan: boolean;
  isFeatured: boolean;
  isActive: boolean;
  foodType?: string;
  dietaryTags?: string[];
  calories?: number;
  servingSize?: string;
  storageInstructions?: string;
  usageInstructions?: string;
  rating: number;
  reviewCount: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
  product: Product;
  lineTotal: number;
  inStock: boolean;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export interface Address {
  id?: string;
  _id?: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark?: string;
  addressType: "home" | "work" | "other";
  isDefault: boolean;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

export interface OrderItem {
  productId: string;
  vendorId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  fulfillmentStatus: OrderStatus;
}

export interface Order {
  id?: string;
  _id?: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
  coupon?: { code: string; amount: number };
  shippingAddress: Address;
  paymentMethod: "cod" | "razorpay" | "mock_online";
  paymentStatus: string;
  orderStatus: OrderStatus;
  notes?: string;
  createdAt: string;
}

export interface Review {
  id?: string;
  _id?: string;
  rating: number;
  title?: string;
  comment: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  customerId?: { firstName: string; lastName: string };
  createdAt: string;
}

export interface Vendor {
  id?: string;
  _id?: string;
  businessName: string;
  slug: string;
  description?: string;
  email: string;
  phone: string;
  logo?: string;
  status: string;
  approvalStatus: string;
  commissionRate: number;
  address: {
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  userId?: { firstName: string; lastName: string; email: string };
}

export interface Coupon {
  id?: string;
  _id?: string;
  couponCode: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumOrderValue: number;
  maximumDiscount?: number;
  startDate: string;
  endDate: string;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
  isActive: boolean;
}

export interface NotificationItem {
  id?: string;
  _id?: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export function entityId(value: { id?: string; _id?: string } | string): string {
  if (typeof value === "string") return value;
  return value.id || value._id || "";
}

export function mediaUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  const configured = (import.meta.env.VITE_API_URL || "").trim();
  if (configured.startsWith("http")) {
    return `${new URL(configured).origin}${path}`;
  }
  return path;
}
