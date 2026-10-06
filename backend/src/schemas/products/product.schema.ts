import { z } from "zod";

const nutritionSchema = z.object({
  calories: z.number().optional(),
  protein: z.number().optional(),
  carbohydrates: z.number().optional(),
  fat: z.number().optional(),
  fiber: z.number().optional(),
  sugar: z.number().optional(),
  sodium: z.number().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().min(10),
  shortDescription: z.string().max(280).optional(),
  sku: z.string().min(3).max(40),
  vendorId: z.string().optional(),
  categoryId: z.string().min(1),
  subCategoryId: z.string().optional(),
  brand: z.string().optional(),
  tasteIndiaRegion: z
    .enum(["north-india", "south-india", "west-india", "east-india", "northeast-india"])
    .optional()
    .nullable(),
  festivalId: z.string().optional().nullable(),
  images: z.array(z.string()).default([]),
  thumbnail: z.string().optional(),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).optional(),
  unit: z.string().optional(),
  weight: z.number().min(0).optional(),
  ingredients: z.string().optional(),
  allergens: z.array(z.string()).optional(),
  nutritionInformation: nutritionSchema.optional(),
  tags: z.array(z.string()).optional(),
  isVegetarian: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  foodType: z.string().optional(),
  dietaryTags: z.array(z.string()).optional(),
  calories: z.number().optional(),
  servingSize: z.string().optional(),
  expiryDate: z.coerce.date().optional(),
  shelfLife: z.string().optional(),
  storageInstructions: z.string().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const productStatusSchema = z.object({
  isActive: z.boolean(),
});

export const inventoryAdjustSchema = z.object({
  type: z.enum(["restock", "adjustment", "damage", "return"]),
  quantity: z.number().int(),
  reason: z.string().optional(),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  vendor: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sort: z
    .enum(["relevance", "price_asc", "price_desc", "rating", "newest", "popular", "discount"])
    .optional(),
  rating: z.coerce.number().optional(),
  vegetarian: z.enum(["true", "false"]).optional(),
  vegan: z.enum(["true", "false"]).optional(),
  featured: z.enum(["true", "false"]).optional(),
  inStock: z.enum(["true", "false"]).optional(),
  brand: z.string().optional(),
  region: z.string().optional(),
  festival: z.string().optional(),
  discount: z.enum(["true", "false"]).optional(),
});
