import { Types } from "mongoose";
import { BadRequestError, NotFoundError } from "../../errors/AppError";
import {
  MerchandisingCollection,
  MerchandisingPlacement,
} from "../../models/MerchandisingCollection";
import { Product, ProductDocument } from "../../models/Product";
import { slugify } from "../../utils/slug";
import { TASTE_INDIA_REGIONS, TasteIndiaRegion } from "../../config/constants";

export interface MerchandisingInput {
  name: string;
  subtitle?: string;
  placement?: MerchandisingPlacement;
  tasteIndiaRegion?: TasteIndiaRegion | null;
  image?: string;
  sortOrder?: number;
  isActive?: boolean;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  productIds?: string[];
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

function tasteIndiaSlugFrom(nameOrSlug: string) {
  const normalized = slugify(nameOrSlug);
  if ((TASTE_INDIA_REGIONS as readonly string[]).includes(normalized)) {
    return normalized;
  }
  return (TASTE_INDIA_REGIONS as readonly string[]).find(
    (region) => normalized === region || normalized.startsWith(`${region}-`),
  );
}

function resolveTasteIndiaRegion(
  value: string | null | undefined,
  placement?: MerchandisingPlacement,
  name?: string,
): TasteIndiaRegion | null | undefined {
  if (value === undefined && placement === undefined && name === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value && (TASTE_INDIA_REGIONS as readonly string[]).includes(value)) {
    return value as TasteIndiaRegion;
  }
  if (placement === "region" && name) {
    return (tasteIndiaSlugFrom(name) as TasteIndiaRegion | undefined) || null;
  }
  if (value !== undefined) {
    throw new BadRequestError("Invalid Taste India region");
  }
  return undefined;
}

async function uniqueSlug(name: string, excludeId?: string, preferredSlug?: string) {
  const base = preferredSlug || slugify(name);
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
    const tasteIndiaRegion = resolveTasteIndiaRegion(
      input.tasteIndiaRegion,
      input.placement,
      input.name,
    );
    const preferredSlug =
      tasteIndiaRegion ||
      (input.placement === "region" ? tasteIndiaSlugFrom(input.name) : undefined);
    const row = await MerchandisingCollection.create({
      name: input.name.trim(),
      slug: await uniqueSlug(input.name, undefined, preferredSlug || undefined),
      subtitle: input.subtitle,
      placement: input.placement || "home",
      tasteIndiaRegion: tasteIndiaRegion || undefined,
      image: input.image,
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
    }
    if (input.placement !== undefined) row.placement = input.placement;
    if (input.tasteIndiaRegion !== undefined || input.placement !== undefined || input.name !== undefined) {
      const region = resolveTasteIndiaRegion(
        input.tasteIndiaRegion !== undefined ? input.tasteIndiaRegion : row.tasteIndiaRegion,
        input.placement ?? row.placement,
        input.name ?? row.name,
      );
      if (region === null) {
        row.set("tasteIndiaRegion", undefined);
      } else if (region) {
        row.tasteIndiaRegion = region;
      }
    }
    if (input.name !== undefined || input.placement !== undefined || input.tasteIndiaRegion !== undefined) {
      const preferredSlug =
        row.tasteIndiaRegion ||
        (row.placement === "region" ? tasteIndiaSlugFrom(row.name) : undefined);
      row.slug = await uniqueSlug(row.name, id, preferredSlug || undefined);
    }
    if (input.subtitle !== undefined) row.subtitle = input.subtitle;
    if (input.image !== undefined) row.image = input.image;
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

  /** Active collections targeted to a Taste India region (explicit region, region placement, or tagged products). */
  async listPublicForRegion(regionSlug: string) {
    if (!(TASTE_INDIA_REGIONS as readonly string[]).includes(regionSlug)) {
      return [] as Awaited<ReturnType<typeof this.listPublic>>;
    }
    const rows = await this.listPublic();
    const matched: typeof rows = [];
    for (const row of rows) {
      const explicit =
        row.tasteIndiaRegion === regionSlug ||
        (row.placement === "region" && tasteIndiaSlugFrom(row.slug) === regionSlug) ||
        (row.placement === "region" && tasteIndiaSlugFrom(row.name) === regionSlug);
      if (explicit) {
        matched.push(row);
        continue;
      }
      if (!row.productIds?.length) continue;
      const hasTaggedProduct = await Product.exists({
        _id: { $in: row.productIds },
        tasteIndiaRegion: regionSlug,
        $or: [{ isActive: true }, { status: "active" }],
      });
      if (hasTaggedProduct) matched.push(row);
    }
    return matched;
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

  /** Products curated on the collection plus products tagged for this region/festival. */
  async productsForCollection(row: {
    _id: Types.ObjectId;
    slug: string;
    placement: string;
    tasteIndiaRegion?: string;
    productIds: Types.ObjectId[];
  }) {
    const explicit = await this.productsFor(row.productIds || []);
    const taggedQuery: Record<string, unknown> = {
      $or: [{ isActive: true }, { status: "active" }],
    };
    if (row.placement === "region" || row.tasteIndiaRegion) {
      taggedQuery.tasteIndiaRegion = row.tasteIndiaRegion || tasteIndiaSlugFrom(row.slug) || row.slug;
    } else if (row.placement === "festival") {
      taggedQuery.festivalId = row._id;
    } else {
      return explicit;
    }
    const tagged = await Product.find(taggedQuery);
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
