import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface NutritionInformation {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export interface ProductDocument extends Document {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  sku: string;
  vendorId: Types.ObjectId;
  categoryId: Types.ObjectId;
  subCategoryId?: Types.ObjectId;
  brand?: string;
  images: string[];
  thumbnail?: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  discount: number;
  stock: number;
  lowStockThreshold: number;
  unit: string;
  weight?: number;
  ingredients?: string;
  allergens?: string[];
  nutritionInformation?: NutritionInformation;
  tags: string[];
  isVegetarian: boolean;
  isVegan: boolean;
  isFeatured: boolean;
  isActive: boolean;
  foodType?: string;
  dietaryTags: string[];
  calories?: number;
  servingSize?: string;
  expiryDate?: Date;
  shelfLife?: string;
  storageInstructions?: string;
  rating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    description: { type: String, required: true },
    shortDescription: { type: String },
    sku: { type: String, required: true, uppercase: true, trim: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    subCategoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    brand: { type: String, trim: true },
    images: { type: [String], default: [] },
    thumbnail: { type: String },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 10, min: 0 },
    unit: { type: String, default: "pack" },
    weight: { type: Number, min: 0 },
    ingredients: { type: String },
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
    tags: { type: [String], default: [] },
    isVegetarian: { type: Boolean, default: true },
    isVegan: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    foodType: { type: String },
    dietaryTags: { type: [String], default: [] },
    calories: { type: Number },
    servingSize: { type: String },
    expiryDate: { type: Date },
    shelfLife: { type: String },
    storageInstructions: { type: String },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ vendorId: 1, isActive: 1 });
productSchema.index({ categoryId: 1, isActive: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ name: "text", brand: "text", tags: "text", shortDescription: "text" });

productSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const Product: Model<ProductDocument> =
  mongoose.models.Product || mongoose.model<ProductDocument>("Product", productSchema);
