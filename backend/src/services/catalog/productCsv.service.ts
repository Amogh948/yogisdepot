import { parse } from "csv-parse/sync";
import { Types } from "mongoose";
import { BadRequestError } from "../../errors/AppError";
import { Brand } from "../../models/Brand";
import { Category } from "../../models/Category";
import { Inventory } from "../../models/Inventory";
import { Pricing } from "../../models/Pricing";
import { Product } from "../../models/Product";
import { Sku } from "../../models/Sku";
import { Vendor } from "../../models/Vendor";
import { TASTE_INDIA_REGIONS } from "../../config/constants";
import { catalogAdminService } from "./catalogAdmin.service";

export const PRODUCT_CSV_HEADERS = [
  "productId",
  "productCode",
  "skuCode",
  "name",
  "brandName",
  "vendorSlug",
  "categorySlugs",
  "imageUrls",
  "description",
  "shortDescription",
  "ingredients",
  "storageInstructions",
  "usageInstructions",
  "manufacturer",
  "countryOfOrigin",
  "tags",
  "tasteIndiaRegion",
  "mrpCents",
  "costPriceCents",
  "sellingPriceCents",
  "availableQuantity",
  "reorderLevel",
  "barcode",
  "isActive",
  "isFeatured",
  "isVegetarian",
  "isVegan",
] as const;

export type ProductCsvHeader = (typeof PRODUCT_CSV_HEADERS)[number];

type CsvRow = Record<string, string>;

export type ProductCsvRowResult = {
  rowNumber: number;
  action: "create" | "update" | "skip";
  skuCode?: string;
  productId?: string;
  name?: string;
  ok: boolean;
  errors: string[];
};

function csvEscape(value: unknown): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function parseIntCents(value: string | undefined, field: string, errors: string[]): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    errors.push(`${field} must be a non-negative integer (cents)`);
    return undefined;
  }
  return n;
}

function splitList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[|,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Image URLs are pipe-separated so commas inside query strings stay intact. */
function splitImageUrls(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function productImageUrls(product: {
  images?: Array<string | { url?: string }>;
  legacyImages?: string[];
  thumbnail?: string;
}): string[] {
  const fromImages = (product.images || [])
    .map((img) => (typeof img === "string" ? img : img.url || ""))
    .filter(Boolean);
  if (fromImages.length) return fromImages;
  if (product.legacyImages?.length) return product.legacyImages.filter(Boolean);
  return product.thumbnail ? [product.thumbnail] : [];
}

function normalizeHeader(header: string) {
  return header.trim().replace(/^\uFEFF/, "");
}

export const productCsvService = {
  async buildTemplateCsv(): Promise<string> {
    const products = await Product.find().sort({ updatedAt: -1 }).limit(5000);
    const skuIds = products.flatMap((p) => p.variants.map((v) => v.skuId).filter(Boolean)) as Types.ObjectId[];
    const [skus, pricingRows, inventoryRows, categories, vendors, brands] = await Promise.all([
      Sku.find({ _id: { $in: skuIds } }),
      Pricing.find({ skuId: { $in: skuIds }, isActive: true }).sort({ effectiveFrom: -1 }),
      Inventory.find({ skuId: { $in: skuIds } }),
      Category.find().select("name slug"),
      Vendor.find().select("businessName slug"),
      Brand.find().select("name slug"),
    ]);

    const categoryById = new Map(categories.map((c) => [String(c._id), c]));
    const vendorById = new Map(vendors.map((v) => [String(v._id), v]));
    const brandById = new Map(brands.map((b) => [String(b._id), b]));
    const skuById = new Map(skus.map((s) => [String(s._id), s]));
    const pricingBySku = new Map<string, (typeof pricingRows)[0]>();
    for (const row of pricingRows) {
      const key = String(row.skuId);
      if (!pricingBySku.has(key)) pricingBySku.set(key, row);
    }
    const inventoryBySku = new Map(inventoryRows.map((row) => [String(row.skuId), row]));

    const lines = [PRODUCT_CSV_HEADERS.join(",")];
    for (const product of products) {
      const variant = product.variants[0];
      const sku = variant?.skuId ? skuById.get(String(variant.skuId)) : undefined;
      const pricing = sku ? pricingBySku.get(String(sku._id)) : undefined;
      const inventory = sku ? inventoryBySku.get(String(sku._id)) : undefined;
      const vendor = vendorById.get(String(product.vendorId));
      const brand = product.brandId ? brandById.get(String(product.brandId)) : undefined;
      const categorySlugs = (product.categoryIds?.length ? product.categoryIds : [product.categoryId])
        .map((id) => categoryById.get(String(id))?.slug)
        .filter(Boolean)
        .join("|");

      const row: Record<ProductCsvHeader, string> = {
        productId: String(product._id),
        productCode: product.productCode || "",
        skuCode: sku?.skuCode || product.sku || "",
        name: product.name || "",
        brandName: brand?.name || product.brand || "",
        vendorSlug: vendor?.slug || "",
        categorySlugs,
        imageUrls: productImageUrls(product).join("|"),
        description: product.description || "",
        shortDescription: product.shortDescription || "",
        ingredients: product.ingredients || "",
        storageInstructions: product.storageInstructions || "",
        usageInstructions: product.usageInstructions || "",
        manufacturer: product.manufacturer || "",
        countryOfOrigin: product.countryOfOrigin || "",
        tags: (product.tags || []).join("|"),
        tasteIndiaRegion: product.tasteIndiaRegion || "",
        mrpCents: String(pricing?.mrpCents ?? Math.round((product.compareAtPrice || 0) * 100)),
        costPriceCents: String(pricing?.costPriceCents ?? Math.round((product.costPrice || 0) * 100)),
        sellingPriceCents: String(pricing?.sellingPriceCents ?? Math.round((product.price || 0) * 100)),
        availableQuantity: String(inventory?.availableQuantity ?? product.stock ?? 0),
        reorderLevel: String(inventory?.reorderLevel ?? 10),
        barcode: sku?.barcode || variant?.barcode || "",
        isActive: product.isActive === false || product.status === "inactive" ? "false" : "true",
        isFeatured: product.isFeatured ? "true" : "false",
        isVegetarian: product.isVegetarian === false ? "false" : "true",
        isVegan: product.isVegan ? "true" : "false",
      };
      lines.push(PRODUCT_CSV_HEADERS.map((header) => csvEscape(row[header])).join(","));
    }

    if (products.length === 0) {
      // Empty template with header only — one example comment row is not needed
    }
    return `${lines.join("\n")}\n`;
  },

  parseCsv(buffer: Buffer): CsvRow[] {
    const records = parse(buffer, {
      columns: (headers: string[]) => headers.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }) as CsvRow[];
    if (!records.length) {
      throw new BadRequestError("CSV has no data rows");
    }
    const keys = Object.keys(records[0] || {});
    if (!keys.includes("skuCode") && !keys.includes("productId") && !keys.includes("productCode")) {
      throw new BadRequestError("CSV must include at least one of: productId, productCode, skuCode");
    }
    if (!keys.includes("name")) {
      throw new BadRequestError("CSV must include a name column");
    }
    return records;
  },

  async processCsv(buffer: Buffer, options: { commit: boolean }): Promise<{
    commit: boolean;
    total: number;
    created: number;
    updated: number;
    failed: number;
    rows: ProductCsvRowResult[];
  }> {
    const records = this.parseCsv(buffer);
    const [vendors, categories] = await Promise.all([
      Vendor.find().select("slug businessName"),
      Category.find().select("slug name"),
    ]);
    const vendorBySlug = new Map(vendors.map((v) => [v.slug.toLowerCase(), v]));
    const categoryBySlug = new Map(categories.map((c) => [c.slug.toLowerCase(), c]));
    const defaultVendor = vendors[0];

    const results: ProductCsvRowResult[] = [];
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (let index = 0; index < records.length; index++) {
      const row = records[index];
      const rowNumber = index + 2; // header is row 1
      const errors: string[] = [];
      const productId = row.productId?.trim();
      const productCode = row.productCode?.trim();
      const skuCode = row.skuCode?.trim().toUpperCase();
      const name = row.name?.trim();

      if (!name) errors.push("name is required");

      let existing =
        productId && Types.ObjectId.isValid(productId)
          ? await Product.findById(productId)
          : null;
      if (!existing && productCode) {
        existing = await Product.findOne({ productCode });
      }
      if (!existing && skuCode) {
        const sku = await Sku.findOne({ skuCode });
        if (sku) existing = await Product.findById(sku.productId);
      }

      const categorySlugs = splitList(row.categorySlugs);
      const categoryIds = categorySlugs
        .map((slug) => categoryBySlug.get(slug.toLowerCase())?._id)
        .filter(Boolean) as Types.ObjectId[];
      if (!categoryIds.length && !existing) {
        errors.push("categorySlugs must include at least one known category slug");
      } else if (categorySlugs.length && categoryIds.length !== categorySlugs.length) {
        errors.push("One or more categorySlugs were not found");
      }

      const vendorSlug = row.vendorSlug?.trim().toLowerCase();
      const vendor = vendorSlug ? vendorBySlug.get(vendorSlug) : defaultVendor;
      if (!vendor && !existing) errors.push("vendorSlug is required (or create a vendor first)");

      const tasteIndiaRegion = row.tasteIndiaRegion?.trim().toLowerCase() || "";
      if (tasteIndiaRegion && !(TASTE_INDIA_REGIONS as readonly string[]).includes(tasteIndiaRegion)) {
        errors.push("tasteIndiaRegion is invalid");
      }

      const imageUrls = splitImageUrls(row.imageUrls);
      for (const url of imageUrls) {
        if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
          errors.push(`Invalid image URL: ${url}`);
          break;
        }
      }

      const mrpCents = parseIntCents(row.mrpCents, "mrpCents", errors);
      const costPriceCents = parseIntCents(row.costPriceCents, "costPriceCents", errors);
      const sellingPriceCents = parseIntCents(row.sellingPriceCents, "sellingPriceCents", errors);
      const availableQuantity = parseIntCents(row.availableQuantity, "availableQuantity", errors);
      const reorderLevel = parseIntCents(row.reorderLevel, "reorderLevel", errors);

      if (!existing) {
        if (!skuCode) errors.push("skuCode is required for new products");
        if (mrpCents == null || costPriceCents == null || sellingPriceCents == null) {
          errors.push("mrpCents, costPriceCents, and sellingPriceCents are required for new products");
        }
      }

      if (errors.length) {
        failed += 1;
        results.push({
          rowNumber,
          action: existing ? "update" : "create",
          skuCode,
          productId: existing ? String(existing._id) : productId,
          name,
          ok: false,
          errors,
        });
        continue;
      }

      const action: "create" | "update" = existing ? "update" : "create";

      if (!options.commit) {
        results.push({
          rowNumber,
          action,
          skuCode,
          productId: existing ? String(existing._id) : undefined,
          name,
          ok: true,
          errors: [],
        });
        if (action === "create") created += 1;
        else updated += 1;
        continue;
      }

      try {
        if (existing) {
          const variant = existing.variants[0];
          await catalogAdminService.updateProductStack(String(existing._id), {
            name,
            brandName: row.brandName?.trim() || undefined,
            categoryIds: categoryIds.length ? categoryIds.map(String) : undefined,
            vendorId: vendor ? String(vendor._id) : undefined,
            description: row.description?.trim() || existing.description,
            shortDescription: row.shortDescription?.trim() || undefined,
            ingredients: row.ingredients?.trim() || undefined,
            storageInstructions: row.storageInstructions?.trim() || undefined,
            usageInstructions: row.usageInstructions?.trim() || undefined,
            manufacturer: row.manufacturer?.trim() || undefined,
            countryOfOrigin: row.countryOfOrigin?.trim() || undefined,
            tags: splitList(row.tags),
            images: row.imageUrls !== undefined && row.imageUrls !== "" ? imageUrls : undefined,
            tasteIndiaRegion: (tasteIndiaRegion || null) as
              | "north-india"
              | "south-india"
              | "west-india"
              | "east-india"
              | "northeast-india"
              | null,
            isActive: parseBool(row.isActive, existing.isActive !== false),
            isFeatured: parseBool(row.isFeatured, Boolean(existing.isFeatured)),
            isVegetarian: parseBool(row.isVegetarian, existing.isVegetarian !== false),
            isVegan: parseBool(row.isVegan, Boolean(existing.isVegan)),
            variants: variant
              ? [
                  {
                    variantId: variant.variantId,
                    barcode: row.barcode?.trim() || undefined,
                    mrpCents,
                    costPriceCents,
                    sellingPriceCents,
                    availableQuantity,
                    reorderLevel,
                  },
                ]
              : undefined,
          });
          updated += 1;
          results.push({
            rowNumber,
            action: "update",
            skuCode,
            productId: String(existing._id),
            name,
            ok: true,
            errors: [],
          });
        } else {
          const createdProduct = await catalogAdminService.createProductStack({
            name: name!,
            brandName: row.brandName?.trim() || undefined,
            categoryIds: categoryIds.map(String),
            vendorId: String(vendor!._id),
            description: row.description?.trim() || name!,
            shortDescription: row.shortDescription?.trim() || undefined,
            ingredients: row.ingredients?.trim() || undefined,
            storageInstructions: row.storageInstructions?.trim() || undefined,
            usageInstructions: row.usageInstructions?.trim() || undefined,
            manufacturer: row.manufacturer?.trim() || undefined,
            countryOfOrigin: row.countryOfOrigin?.trim() || undefined,
            tags: splitList(row.tags),
            images: imageUrls.length ? imageUrls : undefined,
            tasteIndiaRegion: (tasteIndiaRegion || null) as never,
            variants: [
              {
                name: "Default",
                skuCode,
                barcode: row.barcode?.trim() || undefined,
                mrpCents: mrpCents!,
                costPriceCents: costPriceCents!,
                sellingPriceCents: sellingPriceCents!,
                availableQuantity: availableQuantity ?? 0,
                reorderLevel: reorderLevel ?? 10,
              },
            ],
          });
          const newId = String(createdProduct._id);
          await catalogAdminService.updateProductStack(newId, {
            isActive: parseBool(row.isActive, true),
            isFeatured: parseBool(row.isFeatured, false),
            isVegetarian: parseBool(row.isVegetarian, true),
            isVegan: parseBool(row.isVegan, false),
          });
          created += 1;
          results.push({
            rowNumber,
            action: "create",
            skuCode,
            productId: newId,
            name,
            ok: true,
            errors: [],
          });
        }
      } catch (error) {
        failed += 1;
        results.push({
          rowNumber,
          action,
          skuCode,
          productId: existing ? String(existing._id) : undefined,
          name,
          ok: false,
          errors: [error instanceof Error ? error.message : "Row failed"],
        });
      }
    }

    return {
      commit: options.commit,
      total: records.length,
      created,
      updated,
      failed,
      rows: results,
    };
  },
};
