import { Types } from "mongoose";
import { BadRequestError, NotFoundError } from "../../errors/AppError";
import {
  MerchandisingCollection,
  MerchandisingPlacement,
} from "../../models/MerchandisingCollection";
import { Product, ProductDocument } from "../../models/Product";
import { slugify } from "../../utils/slug";
import { FESTIVAL_THEMES, FestivalTheme } from "../../config/constants";

export interface MerchandisingInput {
  name: string;
  subtitle?: string;
  placement?: MerchandisingPlacement;
  festivalTheme?: FestivalTheme;
  image?: string;
  images?: string[];
  sortOrder?: number;
  isActive?: boolean;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  productIds?: string[];
}

function resolveFestivalTheme(value: string | undefined): FestivalTheme | undefined {
  if (value === undefined) return undefined;
  if ((FESTIVAL_THEMES as readonly string[]).includes(value)) {
    return value as FestivalTheme;
  }
  throw new BadRequestError("Invalid festival theme");
}

function normalizeImages(images?: string[], image?: string): string[] | undefined {
  if (images === undefined && image === undefined) return undefined;
  const list = Array.isArray(images)
    ? images.map((url) => String(url || "").trim()).filter(Boolean)
    : [];
  if (!list.length && image?.trim()) list.push(image.trim());
  return [...new Set(list)].slice(0, 12);
}

function parseScheduleDate(value: string | Date | null | undefined, endOfDay = false): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const raw = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(raw.getTime())) {
    throw new BadRequestError("Invalid schedule date");
  }
  const date = new Date(raw);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    date.setFullYear(y, m - 1, d);
  }
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

function assertSchedule(startDate?: Date | null, endDate?: Date | null) {
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new BadRequestError("End date must be on or after the start date");
  }
}

function scheduleFilter(now = new Date()) {
  return {
    $and: [
      {
        $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }],
      },
      {
        $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }],
      },
    ],
  };
}

function isCurrentlyVisible(row: { startDate?: Date | null; endDate?: Date | null }, now = new Date()) {
  if (row.startDate && row.startDate.getTime() > now.getTime()) return false;
  if (row.endDate && row.endDate.getTime() < now.getTime()) return false;
  return true;
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
    if (!input.name?.trim()) {
      throw new BadRequestError("Name is required");
    }
    const productIds = normalizeProductIds(input.productIds);
    await assertProductsExist(productIds);
    const startDate = parseScheduleDate(input.startDate, false) ?? null;
    const endDate = parseScheduleDate(input.endDate, true) ?? null;
    assertSchedule(startDate, endDate);
    const festivalTheme = resolveFestivalTheme(input.festivalTheme);
    const images = normalizeImages(input.images, input.image) || [];
    const row = await MerchandisingCollection.create({
      name: input.name.trim(),
      slug: await uniqueSlug(input.name),
      subtitle: input.subtitle,
      placement: input.placement || "home",
      festivalTheme:
        input.placement === "festival" ? festivalTheme || "generic" : festivalTheme || undefined,
      images,
      image: images[0] || input.image,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      startDate,
      endDate,
      productIds,
    });
    return this.getAdmin(String(row._id));
  },

  async update(id: string, input: Partial<MerchandisingInput>) {
    const row = await MerchandisingCollection.findById(id);
    if (!row) throw new NotFoundError("Merchandising collection not found");
    if (input.name !== undefined) {
      if (!input.name.trim()) {
        throw new BadRequestError("Name is required");
      }
      row.name = input.name.trim();
      row.slug = await uniqueSlug(row.name, id);
    }
    if (input.placement !== undefined) row.placement = input.placement;
    if (input.subtitle !== undefined) row.subtitle = input.subtitle;
    if (input.festivalTheme !== undefined) {
      row.festivalTheme = resolveFestivalTheme(input.festivalTheme) || "generic";
    }
    if (input.images !== undefined) {
      const images = normalizeImages(input.images) || [];
      row.images = images;
      row.image = images[0] || undefined;
    } else if (input.image !== undefined) {
      row.image = input.image || undefined;
      if (input.image) {
        const existing = Array.isArray(row.images) ? row.images.filter(Boolean) : [];
        row.images = existing.length ? [input.image, ...existing.filter((url) => url !== input.image)] : [input.image];
      }
    }
    if (input.sortOrder !== undefined) row.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) row.isActive = input.isActive;
    if (input.startDate !== undefined) row.startDate = parseScheduleDate(input.startDate, false) ?? null;
    if (input.endDate !== undefined) row.endDate = parseScheduleDate(input.endDate, true) ?? null;
    assertSchedule(row.startDate ?? null, row.endDate ?? null);
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
    const filter: Record<string, unknown> = { isActive: true, ...scheduleFilter() };
    if (placement) filter.placement = placement;
    return MerchandisingCollection.find(filter).sort({ sortOrder: 1, createdAt: -1 });
  },

  async getPublicBySlug(slug: string) {
    const row = await MerchandisingCollection.findOne({ slug, isActive: true });
    if (!row || !isCurrentlyVisible(row)) throw new NotFoundError("Collection not found");
    return row;
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

  /** Products curated on the collection plus products tagged for this festival. */
  async productsForCollection(row: {
    _id: Types.ObjectId;
    slug: string;
    placement: string;
    productIds: Types.ObjectId[];
  }) {
    const explicit = await this.productsFor(row.productIds || []);
    if (row.placement !== "festival") {
      return explicit;
    }
    const tagged = await Product.find({
      festivalId: row._id,
      $or: [{ isActive: true }, { status: "active" }],
    });
    const seen = new Set(explicit.map((p) => String(p._id)));
    const merged = [...explicit];
    for (const product of tagged) {
      const id = String(product._id);
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(product);
      }
    }
    return merged;
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
