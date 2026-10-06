import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { TASTE_INDIA_REGIONS } from "../config/constants";

export interface NutritionInformation {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export interface ProductImage {
  url: string;
  type: "front" | "back" | "nutrition" | "ingredients" | "packaging" | "lifestyle" | "other";
  altText?: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  variantId: string;
  variantCode: string;
  name: string;
  size?: { value: number; unit: string };
  packQuantity: number;
  packagingType?: string;
  barcode?: string;
  images: ProductImage[];
  skuId?: Types.ObjectId;
  status: "active" | "inactive";
}

export type ProductStatus = "draft" | "active" | "inactive" | "archived";

export interface ProductSourceMeta {
  system: "woocommerce" | string;
  sourceId: string;
  taxStatus?: string;
  taxClass?: string;
  parentSourceId?: string;
}

export interface ProductDocument extends Document {
  productCode: string;
  name: string;
  slug: string;
  /** External catalog identity for idempotent imports. */
  source?: ProductSourceMeta;
  brandId?: Types.ObjectId;
  /** Legacy string brand kept for dual-read / migration. */
  brand?: string;
  /** Optional Taste India region slug (north-india, south-india, …). */
  tasteIndiaRegion?: string;
  /** Optional Festival Store collection (MerchandisingCollection with placement "festival"). */
  festivalId?: Types.ObjectId;
  /** Primary category (first of categoryIds) — kept for dual-read. */
  categoryId: Types.ObjectId;
  /** All categories this product belongs to. */
  categoryIds: Types.ObjectId[];
  subCategoryId?: Types.ObjectId;
  vendorId: Types.ObjectId;
  description: string;
  shortDescription?: string;
  manufacturer?: string;
  countryOfOrigin?: string;
  ingredients?: string;
  nutritionalInformation?: NutritionInformation;
  allergenInformation?: string[];
  storageInstructions?: string;
  usageInstructions?: string;
  tags: string[];
  images: ProductImage[];
  /** Legacy flat image URLs for dual-read. */
  legacyImages?: string[];
  thumbnail?: string;
  variants: ProductVariant[];
  status: ProductStatus;
  isFeatured: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  foodType?: string;
  dietaryTags: string[];
  servingSize?: string;
  shelfLife?: string;
  rating: number;
  reviewCount: number;
  /** @deprecated Legacy flat catalog fields — prefer Sku/Pricing/Inventory. */
  sku?: string;
  price?: number;
  compareAtPrice?: number;
  costPrice?: number;
  discount?: number;
  stock?: number;
  lowStockThreshold?: number;
  unit?: string;
  weight?: number;
  isActive?: boolean;
  allergens?: string[];
  nutritionInformation?: NutritionInformation;
  calories?: number;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const productImageSchema = new Schema<ProductImage>(
  {
    url: { type: String, required: true },
    type: {
      type: String,
      enum: ["front", "back", "nutrition", "ingredients", "packaging", "lifestyle", "other"],
      default: "front",
    },
    altText: { type: String },
    displayOrder: { type: Number, default: 0 },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

const productVariantSchema = new Schema<ProductVariant>(
  {
    variantId: { type: String, required: true },
    variantCode: { type: String, required: true, uppercase: true },
    name: { type: String, required: true },
    size: {
      value: { type: Number, min: 0 },
      unit: { type: String },
    },
    packQuantity: { type: Number, default: 1, min: 1 },
    packagingType: { type: String },
    barcode: { type: String },
    images: { type: [productImageSchema], default: [] },
    skuId: { type: Schema.Types.ObjectId, ref: "Sku" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { _id: false },
);

const productSchema = new Schema<ProductDocument>(
  {
    productCode: { type: String, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    source: {
      system: { type: String },
      sourceId: { type: String },
      taxStatus: { type: String },
      taxClass: { type: String },
      parentSourceId: { type: String },
    },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand" },
    brand: { type: String, trim: true },
    tasteIndiaRegion: {
      type: String,
      enum: TASTE_INDIA_REGIONS,
    },
    festivalId: { type: Schema.Types.ObjectId, ref: "MerchandisingCollection" },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    subCategoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    description: { type: String, required: true },
    shortDescription: { type: String },
    manufacturer: { type: String },
    countryOfOrigin: { type: String },
    ingredients: { type: String },
    nutritionalInformation: {
      calories: Number,
      protein: Number,
      carbohydrates: Number,
      fat: Number,
      fiber: Number,
      sugar: Number,
      sodium: Number,
    },
    allergenInformation: { type: [String], default: [] },
    storageInstructions: { type: String },
    usageInstructions: { type: String },
    tags: { type: [String], default: [] },
    images: { type: [productImageSchema], default: [] },
    legacyImages: { type: [String], default: undefined },
    thumbnail: { type: String },
    variants: { type: [productVariantSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "archived"],
      default: "active",
    },
    isFeatured: { type: Boolean, default: false },
    isVegetarian: { type: Boolean, default: true },
    isVegan: { type: Boolean, default: false },
    foodType: { type: String },
    dietaryTags: { type: [String], default: [] },
    servingSize: { type: String },
    shelfLife: { type: String },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    // Legacy dual-read fields
    sku: { type: String, uppercase: true, trim: true },
    price: { type: Number, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 10, min: 0 },
    unit: { type: String, default: "pack" },
    weight: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
    allergens: { type: [String], default: [] },
    nutritionInformation: {
      calories: Number,
      protein: Number,
      carbohydrates: Number,
      fat: Number,
      fiber: Number,
      sugar: Number,
      sodium: Number,
    },
    calories: { type: Number },
    expiryDate: { type: Date },
  },
  { timestamps: true },
);

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ productCode: 1 }, { unique: true, sparse: true });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ "source.system": 1, "source.sourceId": 1 }, { unique: true, sparse: true });
productSchema.index({ brandId: 1 });
productSchema.index({ tasteIndiaRegion: 1 });
productSchema.index({ festivalId: 1 });
productSchema.index({ categoryId: 1, status: 1 });
productSchema.index({ categoryIds: 1, status: 1 });
productSchema.index({ vendorId: 1, status: 1 });
productSchema.index({ status: 1 });
productSchema.index({ "variants.variantCode": 1 });
productSchema.index({ name: "text", brand: "text", tags: "text", shortDescription: "text" });

productSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    delete json.costPrice;
    return json;
  },
});

export const Product: Model<ProductDocument> =
  mongoose.models.Product || mongoose.model<ProductDocument>("Product", productSchema);
