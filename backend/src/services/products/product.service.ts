import { FilterQuery } from "mongoose";
import { ForbiddenError, NotFoundError } from "../../errors/AppError";
import { Category } from "../../models/Category";
import { InventoryTransaction } from "../../models/InventoryTransaction";
import { Product, ProductDocument } from "../../models/Product";
import { notificationService } from "../notifications/notification.service";
import { Vendor } from "../../models/Vendor";
import { buildPagination, parsePagination } from "../../utils/pagination";
import { uniqueSlug } from "../../utils/slug";

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

function discountPercent(product: { price: number; compareAtPrice?: number }): number {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) {
    return 0;
  }
  return Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100);
}

export const productService = {
  async create(input: Partial<ProductDocument> & { name: string; sku: string; vendorId: string; categoryId: string }) {
    const slug = uniqueSlug(input.name);
    const discount = discountPercent({
      price: input.price ?? 0,
      compareAtPrice: input.compareAtPrice,
    });
    return Product.create({
      ...input,
      slug,
      sku: input.sku.toUpperCase(),
      thumbnail: input.thumbnail || input.images?.[0],
      discount,
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
    Object.assign(product, input);
    if (input.price !== undefined || input.compareAtPrice !== undefined) {
      product.discount = discountPercent(product);
    }
    if (input.images?.length && !input.thumbnail) {
      product.thumbnail = input.images[0];
    }
    await product.save();
    return product;
  },

  async setStatus(id: string, isActive: boolean, vendorId?: string) {
    return this.update(id, { isActive }, vendorId);
  },

  async remove(id: string, vendorId?: string) {
    return this.setStatus(id, false, vendorId);
  },

  async getById(id: string) {
    const product = await Product.findById(id).populate("vendorId", "businessName slug logo").populate("categoryId", "name slug");
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  },

  async getBySlug(slug: string) {
    const product = await Product.findOne({ slug, isActive: true })
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
      .select("name slug thumbnail price compareAtPrice discount rating reviewCount isVegetarian stock");
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
    const previousStock = product.stock;
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
    if (newStock <= product.lowStockThreshold) {
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
