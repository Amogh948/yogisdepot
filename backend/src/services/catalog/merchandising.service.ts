import { Types } from "mongoose";
import { BadRequestError, NotFoundError } from "../../errors/AppError";
import {
  MerchandisingCollection,
  MerchandisingPlacement,
} from "../../models/MerchandisingCollection";
import { Product, ProductDocument } from "../../models/Product";
import { slugify } from "../../utils/slug";

export interface MerchandisingInput {
  name: string;
  subtitle?: string;
  placement?: MerchandisingPlacement;
  image?: string;
  sortOrder?: number;
  isActive?: boolean;
  productIds?: string[];
}

async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (true) {
    const existing = await MerchandisingCollection.findOne({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!existing) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

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

function toAdminJson(doc: { toJSON: () => Record<string, unknown> }, products?: ProductDocument[]) {
  const json = doc.toJSON();
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
  json.productIds = ((json.productIds as unknown[]) || []).map((id) => String(id));
  json.productCount = Array.isArray(json.productIds) ? json.productIds.length : 0;
  return json;
}

export const merchandisingService = {
  async listAdmin() {
    const rows = await MerchandisingCollection.find().sort({ placement: 1, sortOrder: 1, createdAt: -1 });
    return rows.map((row) => toAdminJson(row));
  },

  async getAdmin(id: string) {
    const row = await MerchandisingCollection.findById(id);
    if (!row) throw new NotFoundError("Merchandising collection not found");
    const products = row.productIds.length
      ? await Product.find({ _id: { $in: row.productIds } }).select("name slug thumbnail isActive price")
      : [];
    const byId = new Map(products.map((p) => [String(p._id), p]));
    const ordered = row.productIds.map((pid) => byId.get(String(pid))).filter(Boolean) as ProductDocument[];
    return toAdminJson(row, ordered);
  },

  async create(input: MerchandisingInput) {
    const productIds = normalizeProductIds(input.productIds);
    await assertProductsExist(productIds);
    const row = await MerchandisingCollection.create({
      name: input.name,
      slug: await uniqueSlug(input.name),
      subtitle: input.subtitle,
      placement: input.placement || "home",
      image: input.image,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      productIds,
    });
    return this.getAdmin(String(row._id));
  },

  async update(id: string, input: Partial<MerchandisingInput>) {
    const row = await MerchandisingCollection.findById(id);
    if (!row) throw new NotFoundError("Merchandising collection not found");
    if (input.name !== undefined) {
      row.name = input.name;
      row.slug = await uniqueSlug(input.name, id);
    }
    if (input.subtitle !== undefined) row.subtitle = input.subtitle;
    if (input.placement !== undefined) row.placement = input.placement;
    if (input.image !== undefined) row.image = input.image;
    if (input.sortOrder !== undefined) row.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) row.isActive = input.isActive;
    if (input.productIds !== undefined) {
      const productIds = normalizeProductIds(input.productIds);
      await assertProductsExist(productIds);
      row.productIds = productIds;
    }
    await row.save();
    return this.getAdmin(id);
  },

  async remove(id: string) {
    const row = await MerchandisingCollection.findByIdAndDelete(id);
    if (!row) throw new NotFoundError("Merchandising collection not found");
    return row;
  },

  async listPublic(placement?: MerchandisingPlacement) {
    const filter: Record<string, unknown> = { isActive: true };
    if (placement) filter.placement = placement;
    return MerchandisingCollection.find(filter).sort({ sortOrder: 1, createdAt: -1 });
  },

  async productsFor(ids: Types.ObjectId[]) {
    if (!ids.length) return [] as ProductDocument[];
    const products = await Product.find({
      _id: { $in: ids },
      $or: [{ isActive: true }, { status: "active" }],
    });
    const byId = new Map(products.map((p) => [String(p._id), p]));
    return ids.map((id) => byId.get(String(id))).filter(Boolean) as ProductDocument[];
  },

  async collectionsForProduct(productId: string) {
    return MerchandisingCollection.find({ productIds: productId }).select("name slug placement isActive");
  },

  async setProductMemberships(productId: string, collectionIds: string[]) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestError("Invalid product id");
    }
    const pid = new Types.ObjectId(productId);
    const unique = [...new Set(collectionIds.filter((id) => Types.ObjectId.isValid(id)))];
    await MerchandisingCollection.updateMany({ productIds: pid }, { $pull: { productIds: pid } });
    if (unique.length) {
      await MerchandisingCollection.updateMany({ _id: { $in: unique } }, { $addToSet: { productIds: pid } });
    }
    return this.collectionsForProduct(productId);
  },
};
