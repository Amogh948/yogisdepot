import { Types } from "mongoose";
import { BadRequestError, NotFoundError } from "../../errors/AppError";
import {
  HOME_SECTION_DEFAULTS,
  HOME_SECTION_KEYS,
  HomeSection,
  HomeSectionDocument,
  HomeSectionKey,
} from "../../models/HomeSection";
import { Product, ProductDocument } from "../../models/Product";

export type HomeSectionInput = {
  title?: string;
  subtitle?: string | null;
  productIds?: string[];
  isActive?: boolean;
  sortOrder?: number;
};

function normalizeProductIds(ids?: string[]) {
  if (!ids?.length) return [] as Types.ObjectId[];
  const unique = [...new Set(ids.filter(Boolean))];
  for (const id of unique) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError(`Invalid product id: ${id}`);
    }
  }
  return unique.map((id) => new Types.ObjectId(id));
}

async function assertProductsExist(ids: Types.ObjectId[]) {
  if (!ids.length) return;
  const count = await Product.countDocuments({ _id: { $in: ids } });
  if (count !== ids.length) {
    throw new BadRequestError("One or more products were not found");
  }
}

async function orderedProducts(ids: Types.ObjectId[], activeOnly = false) {
  if (!ids.length) return [] as ProductDocument[];
  const filter: Record<string, unknown> = { _id: { $in: ids } };
  if (activeOnly) {
    filter.$or = [{ isActive: true }, { status: "active" }];
  }
  const products = await Product.find(filter);
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean) as ProductDocument[];
}

function toAdminJson(doc: HomeSectionDocument, products?: ProductDocument[]) {
  const json = doc.toJSON() as Record<string, unknown>;
  json.productIds = ((json.productIds as unknown[]) || []).map((id) => String(id));
  json.productCount = Array.isArray(json.productIds) ? json.productIds.length : 0;
  if (products) {
    json.products = products.map((p) => {
      const item = p.toJSON() as Record<string, unknown>;
      return {
        id: String(item.id || p._id),
        name: p.name,
        slug: p.slug,
        thumbnail: p.thumbnail,
        isActive: p.isActive,
        price: p.price,
      };
    });
  }
  return json;
}

export const homeSectionService = {
  async defaultProductIdsFor(key: HomeSectionKey) {
    const activeFilter = { $or: [{ isActive: true }, { status: "active" }] };
    let query = Product.find(activeFilter).select("_id").limit(8);
    switch (key) {
      case "bestsellers":
        query = query.sort({ reviewCount: -1, rating: -1 });
        break;
      case "deals":
        query = Product.find({ ...activeFilter, discount: { $gt: 0 } })
          .select("_id")
          .sort({ discount: -1 })
          .limit(8);
        break;
      case "featured":
        query = Product.find({ ...activeFilter, isFeatured: true }).select("_id").limit(8);
        break;
      case "new_arrivals":
        query = query.sort({ createdAt: -1 });
        break;
      default:
        break;
    }
    const rows = await query;
    return rows.map((row) => row._id as Types.ObjectId);
  },

  async ensureDefaults() {
    for (const key of HOME_SECTION_KEYS) {
      const existing = await HomeSection.findOne({ key }).select("_id");
      if (existing) continue;
      const defaults = HOME_SECTION_DEFAULTS[key];
      const productIds = await this.defaultProductIdsFor(key);
      await HomeSection.create({
        key,
        title: defaults.title,
        subtitle: defaults.subtitle || "",
        productIds,
        isActive: true,
        sortOrder: defaults.sortOrder,
      });
    }
  },

  async listAdmin() {
    await this.ensureDefaults();
    const rows = await HomeSection.find().sort({ sortOrder: 1, key: 1 });
    return rows.map((row) => toAdminJson(row));
  },

  async getAdmin(keyOrId: string) {
    await this.ensureDefaults();
    const row = await this.findByKeyOrId(keyOrId);
    const products = await orderedProducts(row.productIds, false);
    return toAdminJson(row, products);
  },

  async findByKeyOrId(keyOrId: string) {
    let row: HomeSectionDocument | null = null;
    if ((HOME_SECTION_KEYS as readonly string[]).includes(keyOrId)) {
      row = await HomeSection.findOne({ key: keyOrId });
    } else if (Types.ObjectId.isValid(keyOrId)) {
      row = await HomeSection.findById(keyOrId);
    }
    if (!row) throw new NotFoundError("Home section not found");
    return row;
  },

  async update(keyOrId: string, input: HomeSectionInput) {
    const row = await this.findByKeyOrId(keyOrId);
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new BadRequestError("Title is required");
      row.title = title;
    }
    if (input.subtitle !== undefined) {
      row.subtitle = input.subtitle?.trim() || "";
    }
    if (input.isActive !== undefined) row.isActive = input.isActive;
    if (input.sortOrder !== undefined) row.sortOrder = input.sortOrder;
    if (input.productIds !== undefined) {
      const productIds = normalizeProductIds(input.productIds);
      await assertProductsExist(productIds);
      row.productIds = productIds;
    }
    await row.save();
    return this.getAdmin(String(row._id));
  },

  async listPublic() {
    await this.ensureDefaults();
    const rows = await HomeSection.find({ isActive: true }).sort({ sortOrder: 1, key: 1 });
    const result: Array<{
      id: string;
      key: HomeSectionKey;
      title: string;
      subtitle?: string;
      sortOrder: number;
      products: ProductDocument[];
    }> = [];
    for (const row of rows) {
      const products = await orderedProducts(row.productIds, true);
      result.push({
        id: String(row._id),
        key: row.key,
        title: row.title,
        subtitle: row.subtitle,
        sortOrder: row.sortOrder,
        products,
      });
    }
    return result;
  },
};
