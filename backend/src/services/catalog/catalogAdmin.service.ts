import { Types } from "mongoose";
import { randomUUID } from "crypto";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../errors/AppError";
import { Brand } from "../../models/Brand";
import { Inventory } from "../../models/Inventory";
import { InventoryBatch } from "../../models/InventoryBatch";
import { MerchandisingCollection } from "../../models/MerchandisingCollection";
import { Pricing } from "../../models/Pricing";
import { Product, ProductDocument, ProductImage, ProductVariant } from "../../models/Product";
import { Sku } from "../../models/Sku";
import { TaxCategory } from "../../models/TaxCategory";
import { Warehouse } from "../../models/Warehouse";
import { buildSkuCode, nextProductCode, nextVariantCode } from "../../utils/businessIds";
import { uniqueSlug } from "../../utils/slug";
import { inventoryReservationService } from "../inventory/inventoryReservation.service";
import { skuOfferService } from "./skuOffer.service";
import { DEFAULT_WAREHOUSE_CODE, TASTE_INDIA_REGIONS, TasteIndiaRegion } from "../../config/constants";

export interface WizardVariantInput {
  name: string;
  sizeValue?: number;
  sizeUnit?: string;
  packQuantity?: number;
  packagingType?: string;
  barcode?: string;
  skuCode?: string;
  mrpCents: number;
  costPriceCents: number;
  sellingPriceCents: number;
  taxCategoryId?: string;
  availableQuantity?: number;
  reorderLevel?: number;
  batch?: {
    batchNumber: string;
    manufacturingDate?: string;
    expiryDate?: string;
    purchasePriceCents: number;
    quantity: number;
  };
}

export interface ProductWizardInput {
  name: string;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryIds?: string[];
  vendorId: string;
  description: string;
  shortDescription?: string;
  manufacturer?: string;
  countryOfOrigin?: string;
  ingredients?: string;
  nutritionalInformation?: ProductDocument["nutritionalInformation"];
  allergenInformation?: string[];
  storageInstructions?: string;
  usageInstructions?: string;
  tags?: string[];
  images?: Array<string | ProductImage>;
  /** Optional Taste India region slug. */
  tasteIndiaRegion?: TasteIndiaRegion | null;
  /** Optional Festival Store merchandising collection id. */
  festivalId?: string | null;
  variants: WizardVariantInput[];
}

export interface ProductStackVariantUpdate {
  variantId: string;
  name?: string;
  status?: "active" | "inactive";
  barcode?: string;
  mrpCents?: number;
  costPriceCents?: number;
  sellingPriceCents?: number;
  availableQuantity?: number;
  reorderLevel?: number;
  taxCategoryId?: string;
}

export interface ProductStackUpdateInput {
  name?: string;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryIds?: string[];
  vendorId?: string;
  description?: string;
  shortDescription?: string;
  manufacturer?: string;
  countryOfOrigin?: string;
  ingredients?: string;
  storageInstructions?: string;
  usageInstructions?: string;
  tags?: string[];
  images?: Array<string | ProductImage>;
  isFeatured?: boolean;
  isActive?: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  /** Pass null or "" to clear. */
  tasteIndiaRegion?: TasteIndiaRegion | null | "";
  /** Pass null or "" to clear. */
  festivalId?: string | null;
  variants?: ProductStackVariantUpdate[];
}

function normalizeImages(images?: Array<string | ProductImage>): ProductImage[] {
  if (!images?.length) return [];
  return images.map((img, index) => {
    if (typeof img === "string") {
      return { url: img, type: "front" as const, displayOrder: index, isPrimary: index === 0, altText: "" };
    }
    return { ...img, displayOrder: img.displayOrder ?? index, isPrimary: img.isPrimary ?? index === 0 };
  });
}

async function resolveBrandId(input: ProductWizardInput): Promise<Types.ObjectId | undefined> {
  if (input.brandId) return new Types.ObjectId(input.brandId);
  if (!input.brandName) return undefined;
  const slug = uniqueSlug(input.brandName);
  let brand = await Brand.findOne({ slug });
  if (!brand) {
    brand = await Brand.create({ name: input.brandName, slug, isActive: true });
  }
  return brand._id;
}

/** Returns slug to set, null to clear, undefined to leave unchanged. */
function resolveTasteIndiaRegion(
  value: string | null | undefined,
): TasteIndiaRegion | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (!(TASTE_INDIA_REGIONS as readonly string[]).includes(value)) {
    throw new BadRequestError("Invalid Taste India region");
  }
  return value as TasteIndiaRegion;
}

/** Returns ObjectId to set, null to clear, undefined to leave unchanged. */
async function resolveFestivalId(
  value: string | null | undefined,
): Promise<Types.ObjectId | null | undefined> {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestError("Invalid festival");
  }
  const festival = await MerchandisingCollection.findOne({ _id: value, placement: "festival" });
  if (!festival) {
    throw new BadRequestError("Festival not found — create one under Festivals / Merchandising with Festival store placement");
  }
  return festival._id;
}

function resolveCategoryIds(input: { categoryId?: string; categoryIds?: string[] }): Types.ObjectId[] {
  const raw = [
    ...(input.categoryIds || []),
    ...(input.categoryId ? [input.categoryId] : []),
  ].filter(Boolean);
  const unique = [...new Set(raw)];
  if (!unique.length) {
    throw new BadRequestError("Select at least one category");
  }
  for (const id of unique) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError(`Invalid category id: ${id}`);
    }
  }
  return unique.map((id) => new Types.ObjectId(id));
}

export const catalogAdminService = {
  async createProductStack(input: ProductWizardInput, options?: { asVendorId?: string }) {
    if (options?.asVendorId && options.asVendorId !== input.vendorId) {
      throw new ForbiddenError("Vendors cannot assign products to another vendor");
    }
    if (!input.variants?.length) {
      throw new BadRequestError("At least one variant is required");
    }

    const brandId = await resolveBrandId(input);
    const tasteIndiaRegion = resolveTasteIndiaRegion(input.tasteIndiaRegion);
    const festivalId = await resolveFestivalId(input.festivalId);
    const categoryIds = resolveCategoryIds(input);
    const productCode = await nextProductCode();
    const images = normalizeImages(input.images);
    const taxCategoryId = input.variants[0].taxCategoryId || (await skuOfferService.ensureTaxCategory());

    const variants: ProductVariant[] = [];
    for (const v of input.variants) {
      variants.push({
        variantId: randomUUID(),
        variantCode: await nextVariantCode(),
        name: v.name,
        size:
          v.sizeValue != null && v.sizeUnit
            ? { value: v.sizeValue, unit: v.sizeUnit }
            : undefined,
        packQuantity: v.packQuantity ?? 1,
        packagingType: v.packagingType,
        barcode: v.barcode,
        images: [],
        status: "active",
      });
    }

    const product = await Product.create({
      productCode,
      name: input.name,
      slug: uniqueSlug(input.name),
      brandId,
      brand: input.brandName,
      tasteIndiaRegion: tasteIndiaRegion || undefined,
      festivalId: festivalId || undefined,
      categoryId: categoryIds[0],
      categoryIds,
      vendorId: input.vendorId,
      description: input.description,
      shortDescription: input.shortDescription,
      manufacturer: input.manufacturer,
      countryOfOrigin: input.countryOfOrigin,
      ingredients: input.ingredients,
      nutritionalInformation: input.nutritionalInformation,
      allergenInformation: input.allergenInformation || [],
      storageInstructions: input.storageInstructions,
      usageInstructions: input.usageInstructions,
      tags: input.tags || [],
      images,
      thumbnail: images.find((i) => i.isPrimary)?.url || images[0]?.url,
      variants,
      status: "active",
      isActive: true,
      // Legacy mirrors from first variant for listing dual-read
      sku: input.variants[0].skuCode?.toUpperCase(),
      price: input.variants[0].sellingPriceCents / 100,
      compareAtPrice: input.variants[0].mrpCents / 100,
      costPrice: input.variants[0].costPriceCents / 100,
      stock: input.variants.reduce((s, v) => s + (v.availableQuantity || 0), 0),
    });

    const warehouse = await inventoryReservationService.getWarehouseOrThrow(DEFAULT_WAREHOUSE_CODE);

    for (let i = 0; i < input.variants.length; i++) {
      const v = input.variants[i];
      const variant = product.variants[i];
      const skuCode =
        v.skuCode?.toUpperCase() ||
        buildSkuCode([input.brandName || "GEN", input.name.slice(0, 8), variant.variantCode.slice(-4)]);

      // Verify variant belongs to product (server-owned ids)
      if (!product.variants.some((pv) => pv.variantId === variant.variantId)) {
        throw new BadRequestError("Variant does not belong to product");
      }

      const sku = await Sku.create({
        skuCode,
        productId: product._id,
        variantId: variant.variantId,
        vendorId: product.vendorId,
        barcode: v.barcode,
        taxCategoryId: v.taxCategoryId || taxCategoryId,
        status: "active",
      });

      variant.skuId = sku._id;
      await Pricing.create({
        skuId: sku._id,
        mrpCents: v.mrpCents,
        costPriceCents: v.costPriceCents,
        sellingPriceCents: v.sellingPriceCents,
        effectiveFrom: new Date(),
        isActive: true,
      });

      const qty = v.availableQuantity ?? v.batch?.quantity ?? 0;
      if (qty > 0) {
        await inventoryReservationService.ensureStockRow({
          skuId: String(sku._id),
          skuCode: sku.skuCode,
          warehouseId: warehouse._id,
          warehouseCode: warehouse.code,
          quantity: qty,
        });
      }

      if (v.batch) {
        await InventoryBatch.create({
          skuId: sku._id,
          warehouseId: warehouse._id,
          batchNumber: v.batch.batchNumber,
          manufacturingDate: v.batch.manufacturingDate ? new Date(v.batch.manufacturingDate) : undefined,
          expiryDate: v.batch.expiryDate ? new Date(v.batch.expiryDate) : undefined,
          purchasePriceCents: v.batch.purchasePriceCents,
          quantityReceived: v.batch.quantity,
          quantityAvailable: v.batch.quantity,
        });
      }
    }

    product.sku = undefined;
    await product.save();
    return product;
  },

  async assertSkuOwnership(skuId: string, vendorId: string) {
    const sku = await Sku.findById(skuId);
    if (!sku) throw new NotFoundError("SKU not found");
    if (String(sku.vendorId) !== vendorId) {
      throw new ForbiddenError("You can only manage your own SKUs");
    }
    return sku;
  },

  async getProductStack(productId: string) {
    const product = await Product.findById(productId)
      .populate("vendorId", "businessName slug logo")
      .populate("categoryId", "name slug")
      .populate("categoryIds", "name slug")
      .populate("brandId", "name slug")
      .populate("festivalId", "name slug placement");
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const warehouse = await inventoryReservationService.getWarehouseOrThrow(DEFAULT_WAREHOUSE_CODE);
    const skuIds = product.variants.map((v) => v.skuId).filter(Boolean) as Types.ObjectId[];
    const [skus, pricingRows, inventoryRows] = await Promise.all([
      Sku.find({ productId: product._id }),
      Pricing.find({ skuId: { $in: skuIds }, isActive: true }).sort({ effectiveFrom: -1 }),
      Inventory.find({ skuId: { $in: skuIds }, warehouseId: warehouse._id }),
    ]);

    const skuByVariant = new Map(skus.map((s) => [s.variantId, s]));
    const pricingBySku = new Map<string, (typeof pricingRows)[0]>();
    for (const row of pricingRows) {
      const key = String(row.skuId);
      if (!pricingBySku.has(key)) pricingBySku.set(key, row);
    }
    const inventoryBySku = new Map(inventoryRows.map((row) => [String(row.skuId), row]));

    const variants = product.variants.map((variant) => {
      const sku = skuByVariant.get(variant.variantId) || (variant.skuId ? skus.find((s) => String(s._id) === String(variant.skuId)) : undefined);
      const pricing = sku ? pricingBySku.get(String(sku._id)) : undefined;
      const inventory = sku ? inventoryBySku.get(String(sku._id)) : undefined;
      return {
        variantId: variant.variantId,
        variantCode: variant.variantCode,
        name: variant.name,
        size: variant.size,
        packQuantity: variant.packQuantity,
        packagingType: variant.packagingType,
        barcode: variant.barcode || sku?.barcode,
        status: variant.status,
        skuId: sku ? String(sku._id) : variant.skuId ? String(variant.skuId) : undefined,
        skuCode: sku?.skuCode,
        taxCategoryId: sku?.taxCategoryId ? String(sku.taxCategoryId) : undefined,
        skuStatus: sku?.status,
        pricing: pricing
          ? {
              id: String(pricing._id),
              mrpCents: pricing.mrpCents,
              costPriceCents: pricing.costPriceCents,
              sellingPriceCents: pricing.sellingPriceCents,
              discountAmountCents: pricing.discountAmountCents,
              discountPercentage: pricing.discountPercentage,
              effectiveFrom: pricing.effectiveFrom,
            }
          : null,
        inventory: inventory
          ? {
              id: String(inventory._id),
              warehouseCode: inventory.warehouseCode,
              availableQuantity: inventory.availableQuantity,
              reservedQuantity: inventory.reservedQuantity,
              damagedQuantity: inventory.damagedQuantity,
              reorderLevel: inventory.reorderLevel,
              reorderQuantity: inventory.reorderQuantity,
            }
          : {
              warehouseCode: warehouse.code,
              availableQuantity: 0,
              reservedQuantity: 0,
              damagedQuantity: 0,
              reorderLevel: 10,
              reorderQuantity: 50,
            },
      };
    });

    const productJson = product.toJSON() as Record<string, unknown>;
    const imageUrls = (product.images || []).map((img) => (typeof img === "string" ? img : img.url)).filter(Boolean);
    const brandPopulated = productJson.brandId as { name?: string; id?: string; _id?: string } | string | undefined;
    const brandName =
      product.brand ||
      (typeof brandPopulated === "object" && brandPopulated ? brandPopulated.name : undefined);

    return {
      ...productJson,
      brandName,
      tasteIndiaRegion: product.tasteIndiaRegion || null,
      festivalId:
        product.festivalId != null
          ? String(
              typeof product.festivalId === "object" && "_id" in (product.festivalId as object)
                ? (product.festivalId as { _id: Types.ObjectId })._id
                : product.festivalId,
            )
          : null,
      categoryIds: (() => {
        const populated = product.categoryIds || [];
        const ids = populated.map((item) =>
          String(typeof item === "object" && item && "_id" in item ? (item as { _id: Types.ObjectId })._id : item),
        );
        if (ids.length) return ids;
        return product.categoryId ? [String(product.categoryId)] : [];
      })(),
      imageUrls,
      variants,
    };
  },

  async updateProductStack(productId: string, input: ProductStackUpdateInput) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (input.name !== undefined) product.name = input.name;
    if (input.description !== undefined) product.description = input.description;
    if (input.shortDescription !== undefined) product.shortDescription = input.shortDescription;
    if (input.categoryId !== undefined || input.categoryIds !== undefined) {
      const categoryIds = resolveCategoryIds({
        categoryId: input.categoryId,
        categoryIds: input.categoryIds,
      });
      product.categoryIds = categoryIds;
      product.categoryId = categoryIds[0];
    }
    if (input.vendorId !== undefined) product.vendorId = new Types.ObjectId(input.vendorId);
    if (input.manufacturer !== undefined) product.manufacturer = input.manufacturer;
    if (input.countryOfOrigin !== undefined) product.countryOfOrigin = input.countryOfOrigin;
    if (input.ingredients !== undefined) product.ingredients = input.ingredients;
    if (input.storageInstructions !== undefined) product.storageInstructions = input.storageInstructions;
    if (input.usageInstructions !== undefined) product.usageInstructions = input.usageInstructions;
    if (input.tags !== undefined) product.tags = input.tags;
    if (input.isFeatured !== undefined) product.isFeatured = input.isFeatured;
    if (input.isVegetarian !== undefined) product.isVegetarian = input.isVegetarian;
    if (input.isVegan !== undefined) product.isVegan = input.isVegan;
    if (input.isActive !== undefined) {
      product.isActive = input.isActive;
      product.status = input.isActive ? "active" : "inactive";
    }

    if (input.tasteIndiaRegion !== undefined) {
      const region = resolveTasteIndiaRegion(input.tasteIndiaRegion);
      if (region === null) {
        product.set("tasteIndiaRegion", undefined);
      } else if (region) {
        product.tasteIndiaRegion = region;
      }
    }

    if (input.festivalId !== undefined) {
      const festivalId = await resolveFestivalId(input.festivalId);
      if (festivalId === null) {
        product.set("festivalId", undefined);
      } else if (festivalId) {
        product.festivalId = festivalId;
      }
    }

    if (input.brandId || input.brandName) {
      const brandId = await resolveBrandId({
        name: product.name,
        brandId: input.brandId,
        brandName: input.brandName,
        categoryId: String(product.categoryId),
        vendorId: String(product.vendorId),
        description: product.description,
        variants: [{ name: "x", mrpCents: 0, costPriceCents: 0, sellingPriceCents: 0 }],
      });
      product.brandId = brandId;
      if (input.brandName !== undefined) product.brand = input.brandName;
    }

    if (input.images) {
      const images = normalizeImages(input.images);
      product.images = images;
      product.thumbnail = images.find((i) => i.isPrimary)?.url || images[0]?.url;
    }

    const warehouse = await inventoryReservationService.getWarehouseOrThrow(DEFAULT_WAREHOUSE_CODE);

    if (input.variants?.length) {
      for (const patch of input.variants) {
        const variant = product.variants.find((v) => v.variantId === patch.variantId);
        if (!variant) {
          throw new BadRequestError(`Variant ${patch.variantId} not found on product`);
        }
        if (patch.name !== undefined) variant.name = patch.name;
        if (patch.status !== undefined) variant.status = patch.status;
        if (patch.barcode !== undefined) variant.barcode = patch.barcode;

        const sku = variant.skuId
          ? await Sku.findById(variant.skuId)
          : await Sku.findOne({ productId: product._id, variantId: variant.variantId });
        if (!sku) {
          throw new NotFoundError(`SKU missing for variant ${patch.variantId}`);
        }

        if (patch.barcode !== undefined) sku.barcode = patch.barcode || undefined;
        if (patch.taxCategoryId !== undefined) {
          sku.taxCategoryId = new Types.ObjectId(patch.taxCategoryId);
        }
        if (patch.status === "inactive") sku.status = "inactive";
        if (patch.status === "active") sku.status = "active";
        await sku.save();

        const pricingTouched =
          patch.mrpCents !== undefined ||
          patch.costPriceCents !== undefined ||
          patch.sellingPriceCents !== undefined;
        if (pricingTouched) {
          const current = await Pricing.findOne({ skuId: sku._id, isActive: true }).sort({ effectiveFrom: -1 });
          const nextMrp = patch.mrpCents ?? current?.mrpCents ?? 0;
          const nextCost = patch.costPriceCents ?? current?.costPriceCents ?? 0;
          const nextSell = patch.sellingPriceCents ?? current?.sellingPriceCents ?? 0;
          if (current) {
            current.isActive = false;
            current.effectiveUntil = new Date();
            await current.save();
          }
          await Pricing.create({
            skuId: sku._id,
            mrpCents: nextMrp,
            costPriceCents: nextCost,
            sellingPriceCents: nextSell,
            effectiveFrom: new Date(),
            isActive: true,
          });
        }

        if (patch.availableQuantity !== undefined || patch.reorderLevel !== undefined) {
          const existing = await Inventory.findOne({ skuId: sku._id, warehouseId: warehouse._id });
          if (!existing) {
            await Inventory.create({
              skuId: sku._id,
              skuCode: sku.skuCode,
              warehouseId: warehouse._id,
              warehouseCode: warehouse.code,
              availableQuantity: patch.availableQuantity ?? 0,
              reservedQuantity: 0,
              damagedQuantity: 0,
              reorderLevel: patch.reorderLevel ?? 10,
              reorderQuantity: 50,
            });
          } else {
            if (patch.availableQuantity !== undefined) {
              existing.availableQuantity = patch.availableQuantity;
            }
            if (patch.reorderLevel !== undefined) {
              existing.reorderLevel = patch.reorderLevel;
            }
            await existing.save();
          }
        }
      }
    }

    // Keep legacy dual-read fields aligned with first active variant pricing/stock
    const firstVariant = product.variants.find((v) => v.status === "active") || product.variants[0];
    if (firstVariant?.skuId) {
      const pricing = await Pricing.findOne({ skuId: firstVariant.skuId, isActive: true }).sort({
        effectiveFrom: -1,
      });
      const inv = await Inventory.findOne({ skuId: firstVariant.skuId, warehouseId: warehouse._id });
      if (pricing) {
        product.price = pricing.sellingPriceCents / 100;
        product.compareAtPrice = pricing.mrpCents / 100;
        product.costPrice = pricing.costPriceCents / 100;
        product.discount =
          pricing.mrpCents > pricing.sellingPriceCents
            ? Math.round(((pricing.mrpCents - pricing.sellingPriceCents) / pricing.mrpCents) * 100)
            : 0;
      }
      if (inv) {
        product.stock = inv.availableQuantity;
      }
    }

    await product.save();
    return this.getProductStack(productId);
  },

  async listBrands() {
    return Brand.find().sort({ name: 1 });
  },

  async createBrand(input: { name: string; description?: string; logoUrl?: string; isActive?: boolean }) {
    return Brand.create({
      name: input.name,
      slug: uniqueSlug(input.name),
      description: input.description,
      logoUrl: input.logoUrl,
      isActive: input.isActive ?? true,
    });
  },

  async updateBrand(
    id: string,
    input: { name?: string; description?: string; logoUrl?: string; isActive?: boolean },
  ) {
    const brand = await Brand.findById(id);
    if (!brand) throw new NotFoundError("Brand not found");
    if (input.name !== undefined && input.name !== brand.name) {
      brand.name = input.name;
      brand.slug = uniqueSlug(input.name);
    }
    if (input.description !== undefined) brand.description = input.description;
    if (input.logoUrl !== undefined) brand.logoUrl = input.logoUrl;
    if (input.isActive !== undefined) brand.isActive = input.isActive;
    await brand.save();
    return brand;
  },

  async removeBrand(id: string) {
    const brand = await Brand.findById(id);
    if (!brand) throw new NotFoundError("Brand not found");
    const linked = await Product.countDocuments({ brandId: brand._id });
    if (linked > 0) {
      throw new BadRequestError("Remove or reassign products from this brand before deleting it");
    }
    await brand.deleteOne();
    return brand;
  },

  async listPublicBrands() {
    return Brand.find({ isActive: true }).sort({ name: 1 });
  },

  async getPublicBrand(slug: string) {
    const brand = await Brand.findOne({ slug, isActive: true });
    if (!brand) throw new NotFoundError("Brand not found");
    return brand;
  },

  async listTaxCategories() {
    return TaxCategory.find().sort({ name: 1 });
  },

  async listWarehouses() {
    return Warehouse.find().sort({ code: 1 });
  },

  async listSkus(query?: { vendorId?: string }) {
    const filter: Record<string, unknown> = {};
    if (query?.vendorId) filter.vendorId = query.vendorId;
    return Sku.find(filter).sort({ createdAt: -1 }).limit(200).populate("productId", "name slug");
  },
};
