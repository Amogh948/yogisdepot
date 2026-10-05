import { FilterQuery } from "mongoose";
import { ForbiddenError, NotFoundError } from "../../errors/AppError";
import { Cart } from "../../models/Cart";
import { Category } from "../../models/Category";
import { Inventory } from "../../models/Inventory";
import { InventoryBatch } from "../../models/InventoryBatch";
import { InventoryReservation } from "../../models/InventoryReservation";
import { InventoryTransaction } from "../../models/InventoryTransaction";
import { MerchandisingCollection } from "../../models/MerchandisingCollection";
import { Pricing } from "../../models/Pricing";
import { Product, ProductDocument, ProductImage } from "../../models/Product";
import { Review } from "../../models/Review";
import { Sku } from "../../models/Sku";
import { Wishlist } from "../../models/Wishlist";
import { notificationService } from "../notifications/notification.service";
import { Vendor } from "../../models/Vendor";
import { buildPagination, parsePagination } from "../../utils/pagination";
import { catalogAdminService } from "../catalog/catalogAdmin.service";
import { dollarsToCents } from "../../utils/money";

export interface ProductListQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  subcategory?: string;
  vendor?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  rating?: number;
  vegetarian?: string;
  vegan?: string;
  featured?: string;
  inStock?: string;
  brand?: string;
  discount?: string;
}

function discountPercent(product: { price?: number; compareAtPrice?: number }): number {
  if (!product.compareAtPrice || !product.price || product.compareAtPrice <= product.price) {
    return 0;
  }
  return Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100);
}

function coerceImages(images: unknown): ProductImage[] | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  if (typeof images[0] === "string") {
    return (images as string[]).map((url, index) => ({
      url,
      type: "front" as const,
      displayOrder: index,
      isPrimary: index === 0,
    }));
  }
  return images as ProductImage[];
}

export const productService = {
  async create(input: Partial<ProductDocument> & { name: string; sku: string; vendorId: string; categoryId: string }) {
    // Prefer FMCG stack: Product + variant + SKU + pricing + inventory
    const images = coerceImages(input.images) || [];
    return catalogAdminService.createProductStack({
      name: input.name,
      brandName: input.brand,
      categoryId: input.categoryId,
      vendorId: String(input.vendorId),
      description: input.description || input.name,
      shortDescription: input.shortDescription,
      ingredients: input.ingredients,
      nutritionalInformation: input.nutritionInformation || input.nutritionalInformation,
      allergenInformation: input.allergens || input.allergenInformation,
      storageInstructions: input.storageInstructions,
      tags: input.tags,
      images,
      variants: [
        {
          name: input.unit || "Default",
          packQuantity: 1,
          skuCode: input.sku,
          mrpCents: dollarsToCents(input.compareAtPrice ?? input.price ?? 0),
          costPriceCents: dollarsToCents(input.costPrice ?? 0),
          sellingPriceCents: dollarsToCents(input.price ?? 0),
          availableQuantity: input.stock ?? 0,
        },
      ],
    });
  },

  async update(id: string, input: Partial<ProductDocument>, vendorId?: string) {
    const product = await Product.findById(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    if (vendorId && String(product.vendorId) !== vendorId) {
      throw new ForbiddenError("You can only manage your own products");
    }
    const images = coerceImages(input.images);
    Object.assign(product, { ...input, ...(images ? { images } : {}) });
    if (input.price !== undefined || input.compareAtPrice !== undefined) {
      product.discount = discountPercent(product);
    }
    if (images?.length && !input.thumbnail) {
      product.thumbnail = images[0].url;
    }
    await product.save();
    return product;
  },

  async setStatus(id: string, isActive: boolean, vendorId?: string) {
    const product = await Product.findById(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    if (vendorId && String(product.vendorId) !== vendorId) {
      throw new ForbiddenError("You can only manage your own products");
    }
    const updated = await Product.findByIdAndUpdate(
      id,
      { isActive, status: isActive ? "active" : "inactive" },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundError("Product not found");
    }
    return updated;
  },

  async remove(id: string, vendorId?: string) {
    const product = await Product.findById(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    if (vendorId && String(product.vendorId) !== vendorId) {
      throw new ForbiddenError("You can only manage your own products");
    }

    const skus = await Sku.find({ productId: product._id }).select("_id");
    const skuIds = skus.map((sku) => sku._id);

    if (skuIds.length) {
      await Promise.all([
        Pricing.deleteMany({ skuId: { $in: skuIds } }),
        Inventory.deleteMany({ skuId: { $in: skuIds } }),
        InventoryBatch.deleteMany({ skuId: { $in: skuIds } }),
        InventoryReservation.deleteMany({ skuId: { $in: skuIds } }),
        Cart.updateMany({}, { $pull: { items: { skuId: { $in: skuIds } } } }),
      ]);
      await Sku.deleteMany({ _id: { $in: skuIds } });
    }

    await Promise.all([
      MerchandisingCollection.updateMany({ productIds: product._id }, { $pull: { productIds: product._id } }),
      Wishlist.deleteMany({ productId: product._id }),
      Review.deleteMany({ productId: product._id }),
      InventoryTransaction.deleteMany({ productId: product._id }),
      Cart.updateMany({}, { $pull: { items: { productId: product._id } } }),
    ]);

    await Product.deleteOne({ _id: product._id });
    return product;
  },

  async getById(id: string) {
    const product = await Product.findById(id).populate("vendorId", "businessName slug logo").populate("categoryId", "name slug");
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  },

  async getBySlug(slug: string) {
    const product = await Product.findOne({
      slug,
      $or: [{ isActive: true }, { status: "active" }],
    })
      .populate("vendorId", "businessName slug logo")
      .populate("categoryId", "name slug")
      .populate("subCategoryId", "name slug");
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  },

  async list(query: ProductListQuery, options?: { vendorScope?: string; includeInactive?: boolean }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: FilterQuery<ProductDocument> = {};
    if (!options?.includeInactive) {
      filter.isActive = true;
    }
    if (options?.vendorScope) {
      filter.vendorId = options.vendorScope;
    }
    if (query.vendor) filter.vendorId = query.vendor;
    if (query.category) {
      const categoryFilter: Record<string, unknown>[] = [{ slug: query.category }];
      if (/^[a-f0-9]{24}$/i.test(query.category)) {
        categoryFilter.push({ _id: query.category });
      }
      const category = await Category.findOne({ $or: categoryFilter });
      if (category) {
        const children = await Category.find({ parentId: category._id }).select("_id");
        filter.categoryId = { $in: [category._id, ...children.map((c) => c._id)] };
      }
    }
    if (query.subcategory) {
      filter.subCategoryId = query.subcategory;
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }
    if (query.rating) filter.rating = { $gte: query.rating };
    if (query.vegetarian === "true") filter.isVegetarian = true;
    if (query.vegan === "true") filter.isVegan = true;
    if (query.featured === "true") filter.isFeatured = true;
    if (query.inStock === "true") filter.stock = { $gt: 0 };
    if (query.brand) filter.brand = { $regex: query.brand, $options: "i" };
    if (query.discount === "true") filter.discount = { $gt: 0 };
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: "i" } },
        { brand: { $regex: query.search, $options: "i" } },
        { tags: { $regex: query.search, $options: "i" } },
        { sku: { $regex: query.search, $options: "i" } },
      ];
    }

    let sort: Record<string, 1 | -1> = { createdAt: -1 };
    switch (query.sort) {
      case "price_asc":
        sort = { price: 1 };
        break;
      case "price_desc":
        sort = { price: -1 };
        break;
      case "rating":
        sort = { rating: -1 };
        break;
      case "newest":
        sort = { createdAt: -1 };
        break;
      case "popular":
        sort = { reviewCount: -1, rating: -1 };
        break;
      case "discount":
        sort = { discount: -1 };
        break;
      default:
        sort = query.search ? { rating: -1, createdAt: -1 } : { isFeatured: -1, createdAt: -1 };
    }

    const [data, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("vendorId", "businessName slug")
        .populate("categoryId", "name slug"),
      Product.countDocuments(filter),
    ]);

    return { data, pagination: buildPagination(page, limit, total) };
  },

  async related(productId: string) {
    const product = await Product.findById(productId);
    if (!product) {
      return [];
    }
    return Product.find({
      _id: { $ne: product._id },
      isActive: true,
      categoryId: product.categoryId,
    })
      .limit(8)
      .select("name slug thumbnail images price compareAtPrice discount rating reviewCount isVegetarian stock variants");
  },

  async adjustInventory(
    productId: string,
    vendorId: string,
    type: "restock" | "adjustment" | "damage" | "return" | "sale",
    quantity: number,
    reason?: string,
  ) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    if (String(product.vendorId) !== vendorId) {
      throw new ForbiddenError("You can only manage your own inventory");
    }
    const previousStock = product.stock ?? 0;
    let delta = quantity;
    if (type === "sale" || type === "damage") {
      delta = -Math.abs(quantity);
    } else if (type === "restock" || type === "return") {
      delta = Math.abs(quantity);
    }
    const newStock = Math.max(0, previousStock + delta);
    product.stock = newStock;
    await product.save();
    await InventoryTransaction.create({
      productId: product._id,
      vendorId: product.vendorId,
      type,
      quantity: delta,
      previousStock,
      newStock,
      reason,
    });
    if (newStock <= (product.lowStockThreshold ?? 10)) {
      const vendor = await Vendor.findById(vendorId);
      if (vendor) {
        await notificationService.notify({
          userId: vendor.userId,
          type: "stock_low",
          title: "Low stock alert",
          body: `${product.name} is down to ${newStock} units.`,
          metadata: { productId: product.id },
        });
      }
    }
    return product;
  },

  async inventoryHistory(productId: string, vendorId?: string) {
    const filter: Record<string, unknown> = { productId };
    if (vendorId) filter.vendorId = vendorId;
    return InventoryTransaction.find(filter).sort({ createdAt: -1 }).limit(100);
  },
};
