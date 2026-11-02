import { parse } from "csv-parse/sync";
import { Types } from "mongoose";
import { BadRequestError } from "../../errors/AppError";
import { Brand } from "../../models/Brand";
import { Category } from "../../models/Category";
import { Inventory } from "../../models/Inventory";
import { MerchandisingCollection } from "../../models/MerchandisingCollection";
import { Pricing } from "../../models/Pricing";
import { Product, type ProductStatus } from "../../models/Product";
import { Sku } from "../../models/Sku";
import { TaxCategory } from "../../models/TaxCategory";
import { Vendor } from "../../models/Vendor";
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
  "mrpCents",
  "costPriceCents",
  "sellingPriceCents",
  "availableQuantity",
  "reorderLevel",
  "barcode",
  "variantName",
  "variantStatus",
  "sizeValue",
  "sizeUnit",
  "packQuantity",
  "packagingType",
  "taxCategoryCode",
  "isActive",
  "isFeatured",
  "isVegetarian",
  "isVegan",
  "unlimitedQuantity",
  "sellIndependently",
  "status",
  "festivalSlug",
  "returnWindowDays",
  "deliveryEstimateDays",
  "childProducts",
  "foodType",
  "dietaryTags",
  "allergens",
  "servingSize",
  "shelfLife",
  "unit",
  "weight",
  "calories",
  "protein",
  "carbohydrates",
  "fat",
  "fiber",
  "sugar",
  "sodium",
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

function hasValue(row: CsvRow, key: string) {
  return Object.prototype.hasOwnProperty.call(row, key) && String(row[key] ?? "").trim() !== "";
}

function parseOptionalNumber(
  value: string | undefined,
  field: string,
  errors: string[],
  options?: { integer?: boolean; min?: number },
): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  const min = options?.min ?? 0;
  if (!Number.isFinite(n) || n < min || (options?.integer && !Number.isInteger(n))) {
    errors.push(
      options?.integer ? `${field} must be a whole number of at least ${min}` : `${field} must be a number of at least ${min}`,
    );
    return undefined;
  }
  return n;
}

const PRODUCT_STATUSES: ProductStatus[] = ["draft", "active", "inactive", "archived"];

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

function text(row: CsvRow, key: string) {
  return hasValue(row, key) ? row[key].trim() : undefined;
}

async function includedProducts(value: string | undefined, errors: string[]) {
  if (!value?.trim()) return undefined;
  const links: Array<{ productId: string; quantity: number }> = [];
  for (const part of value.split("|")) {
    const [codeRaw, qtyRaw] = part.split(":");
    const code = codeRaw?.trim();
    if (!code) continue;
    const quantity = qtyRaw?.trim() ? Number(qtyRaw.trim()) : 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      errors.push(`childProducts quantity for ${code} must be a whole number from 1 to 99`);
      continue;
    }
    const child = /^[a-f0-9]{24}$/i.test(code)
      ? await Product.findById(code).select("_id")
      : await Product.findOne({ productCode: code.toUpperCase() }).select("_id");
    if (!child) {
      errors.push(`Included product ${code} was not found. Import that product first.`);
      continue;
    }
    links.push({ productId: String(child._id), quantity });
  }
  return links;
}

function normalizeHeader(header: string) {
  return header.trim().replace(/^\uFEFF/, "");
}

export const productCsvService = {
  async buildTemplateCsv(): Promise<string> {
    const products = await Product.find().sort({ updatedAt: -1 }).limit(5000);
    const skuIds = products.flatMap((p) => p.variants.map((v) => v.skuId).filter(Boolean)) as Types.ObjectId[];
    const childIds = products.flatMap((p) => (p.childProducts || []).map((link) => link.productId));
    const [skus, pricingRows, inventoryRows, categories, vendors, brands, festivals, taxCategories, childProducts] =
      await Promise.all([
      Sku.find({ _id: { $in: skuIds } }),
      Pricing.find({ skuId: { $in: skuIds }, isActive: true }).sort({ effectiveFrom: -1 }),
      Inventory.find({ skuId: { $in: skuIds } }),
      Category.find().select("name slug"),
      Vendor.find().select("businessName slug"),
      Brand.find().select("name slug"),
      MerchandisingCollection.find({ placement: "festival" }).select("name slug"),
      TaxCategory.find().select("name code"),
      Product.find({ _id: { $in: childIds } }).select("productCode"),
    ]);

    const categoryById = new Map(categories.map((c) => [String(c._id), c]));
    const vendorById = new Map(vendors.map((v) => [String(v._id), v]));
    const brandById = new Map(brands.map((b) => [String(b._id), b]));
    const skuById = new Map(skus.map((s) => [String(s._id), s]));
    const festivalById = new Map(festivals.map((festival) => [String(festival._id), festival]));
    const taxById = new Map(taxCategories.map((tax) => [String(tax._id), tax]));
    const childCodeById = new Map(childProducts.map((child) => [String(child._id), child.productCode || String(child._id)]));
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
      const nutrition = product.nutritionalInformation || product.nutritionInformation || {};
      const festival = product.festivalId ? festivalById.get(String(product.festivalId)) : undefined;
      const tax = sku?.taxCategoryId ? taxById.get(String(sku.taxCategoryId)) : undefined;
      const included = (product.childProducts || [])
        .map((link) => {
          const code = childCodeById.get(String(link.productId));
          return code ? `${code}:${Math.max(1, link.quantity || 1)}` : "";
        })
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
        mrpCents: String(pricing?.mrpCents ?? Math.round((product.compareAtPrice || 0) * 100)),
        costPriceCents: String(pricing?.costPriceCents ?? Math.round((product.costPrice || 0) * 100)),
        sellingPriceCents: String(pricing?.sellingPriceCents ?? Math.round((product.price || 0) * 100)),
        availableQuantity: String(inventory?.availableQuantity ?? product.stock ?? 0),
        reorderLevel: String(inventory?.reorderLevel ?? 10),
        barcode: sku?.barcode || variant?.barcode || "",
        variantName: variant?.name || "",
        variantStatus: variant?.status || "",
        sizeValue: variant?.size?.value != null ? String(variant.size.value) : "",
        sizeUnit: variant?.size?.unit || "",
        packQuantity: variant ? String(variant.packQuantity || 1) : "",
        packagingType: variant?.packagingType || "",
        taxCategoryCode: tax?.code || "",
        isActive: product.isActive === false || product.status === "inactive" ? "false" : "true",
        isFeatured: product.isFeatured ? "true" : "false",
        isVegetarian: product.isVegetarian === false ? "false" : "true",
        isVegan: product.isVegan ? "true" : "false",
        unlimitedQuantity: product.unlimitedQuantity === false ? "false" : "true",
        sellIndependently: product.sellIndependently === false ? "false" : "true",
        status: product.status || "",
        festivalSlug: festival?.slug || "",
        returnWindowDays: String(product.returnWindowDays ?? 0),
        deliveryEstimateDays: String(product.deliveryEstimateDays ?? 5),
        childProducts: included,
        foodType: product.foodType || "",
        dietaryTags: (product.dietaryTags || []).join("|"),
        allergens: (product.allergenInformation?.length ? product.allergenInformation : product.allergens || []).join("|"),
        servingSize: product.servingSize || "",
        shelfLife: product.shelfLife || "",
        unit: product.unit || "",
        weight: product.weight != null ? String(product.weight) : "",
        calories: nutrition.calories != null ? String(nutrition.calories) : "",
        protein: nutrition.protein != null ? String(nutrition.protein) : "",
        carbohydrates: nutrition.carbohydrates != null ? String(nutrition.carbohydrates) : "",
        fat: nutrition.fat != null ? String(nutrition.fat) : "",
        fiber: nutrition.fiber != null ? String(nutrition.fiber) : "",
        sugar: nutrition.sugar != null ? String(nutrition.sugar) : "",
        sodium: nutrition.sodium != null ? String(nutrition.sodium) : "",
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
    const [vendors, categories, festivals, taxCategories] = await Promise.all([
      Vendor.find().select("slug businessName"),
      Category.find().select("slug name"),
      MerchandisingCollection.find({ placement: "festival" }).select("slug name"),
      TaxCategory.find().select("code name"),
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
      const sizeValue = parseOptionalNumber(row.sizeValue, "sizeValue", errors, { min: 0 });
      const packQuantity = parseOptionalNumber(row.packQuantity, "packQuantity", errors, { integer: true, min: 1 });
      const returnWindowDays = parseOptionalNumber(row.returnWindowDays, "returnWindowDays", errors, { integer: true, min: 0 });
      const deliveryEstimateDays = parseOptionalNumber(row.deliveryEstimateDays, "deliveryEstimateDays", errors, {
        integer: true,
        min: 1,
      });
      const weight = parseOptionalNumber(row.weight, "weight", errors, { min: 0 });
      const nutrition = {
        calories: parseOptionalNumber(row.calories, "calories", errors),
        protein: parseOptionalNumber(row.protein, "protein", errors),
        carbohydrates: parseOptionalNumber(row.carbohydrates, "carbohydrates", errors),
        fat: parseOptionalNumber(row.fat, "fat", errors),
        fiber: parseOptionalNumber(row.fiber, "fiber", errors),
        sugar: parseOptionalNumber(row.sugar, "sugar", errors),
        sodium: parseOptionalNumber(row.sodium, "sodium", errors),
      };
      const filledNutrition = Object.fromEntries(Object.entries(nutrition).filter((entry) => entry[1] !== undefined));
      const hasNutrition = Object.keys(filledNutrition).length > 0;

      let festivalId: string | undefined;
      if (hasValue(row, "festivalSlug")) {
        const key = row.festivalSlug.trim().toLowerCase();
        const festival = festivals.find((item) => item.slug === key || item.name.toLowerCase() === key);
        if (!festival) errors.push(`festivalSlug "${row.festivalSlug.trim()}" was not found`);
        else festivalId = String(festival._id);
      }

      let taxCategoryId: string | undefined;
      if (hasValue(row, "taxCategoryCode")) {
        const key = row.taxCategoryCode.trim().toLowerCase();
        const tax = taxCategories.find((item) => item.code.toLowerCase() === key || item.name.toLowerCase() === key);
        if (!tax) errors.push(`taxCategoryCode "${row.taxCategoryCode.trim()}" was not found`);
        else taxCategoryId = String(tax._id);
      }

      let status: ProductStatus | undefined;
      if (hasValue(row, "status")) {
        const value = row.status.trim().toLowerCase() as ProductStatus;
        if (!PRODUCT_STATUSES.includes(value)) errors.push("status must be draft, active, inactive, or archived");
        else status = value;
      }

      let variantStatus: "active" | "inactive" | undefined;
      if (hasValue(row, "variantStatus")) {
        const value = row.variantStatus.trim().toLowerCase();
        if (value !== "active" && value !== "inactive") errors.push("variantStatus must be active or inactive");
        else variantStatus = value;
      }
      if (sizeValue != null && !text(row, "sizeUnit") && !existing?.variants[0]?.size?.unit) {
        errors.push("sizeUnit is required when sizeValue is set");
      }
      if (text(row, "sizeUnit") && sizeValue == null && existing?.variants[0]?.size?.value == null) {
        errors.push("sizeValue is required when sizeUnit is set");
      }

      const childLinks = await includedProducts(hasValue(row, "childProducts") ? row.childProducts : undefined, errors);

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
            tags: hasValue(row, "tags") ? splitList(row.tags) : undefined,
            images: hasValue(row, "imageUrls") ? imageUrls : undefined,
            isActive: hasValue(row, "isActive") ? parseBool(row.isActive, existing.isActive !== false) : undefined,
            isFeatured: hasValue(row, "isFeatured") ? parseBool(row.isFeatured, Boolean(existing.isFeatured)) : undefined,
            isVegetarian: hasValue(row, "isVegetarian") ? parseBool(row.isVegetarian, existing.isVegetarian !== false) : undefined,
            isVegan: hasValue(row, "isVegan") ? parseBool(row.isVegan, Boolean(existing.isVegan)) : undefined,
            unlimitedQuantity: hasValue(row, "unlimitedQuantity")
              ? parseBool(row.unlimitedQuantity, existing.unlimitedQuantity !== false)
              : undefined,
            sellIndependently: hasValue(row, "sellIndependently")
              ? parseBool(row.sellIndependently, existing.sellIndependently !== false)
              : undefined,
            status,
            festivalId,
            returnWindowDays,
            deliveryEstimateDays,
            childProducts: childLinks,
            foodType: text(row, "foodType"),
            dietaryTags: hasValue(row, "dietaryTags") ? splitList(row.dietaryTags) : undefined,
            servingSize: text(row, "servingSize"),
            shelfLife: text(row, "shelfLife"),
            unit: text(row, "unit"),
            weight,
            nutritionalInformation: hasNutrition ? filledNutrition : undefined,
            allergenInformation: hasValue(row, "allergens") ? splitList(row.allergens) : undefined,
            variants: variant
              ? [
                  {
                    variantId: variant.variantId,
                    name: text(row, "variantName"),
                    status: variantStatus,
                    barcode: text(row, "barcode"),
                    sizeValue,
                    sizeUnit: text(row, "sizeUnit"),
                    packQuantity,
                    packagingType: text(row, "packagingType"),
                    taxCategoryId,
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
            tags: hasValue(row, "tags") ? splitList(row.tags) : undefined,
            images: imageUrls.length ? imageUrls : undefined,
            nutritionalInformation: hasNutrition ? filledNutrition : undefined,
            allergenInformation: hasValue(row, "allergens") ? splitList(row.allergens) : undefined,
            festivalId,
            returnWindowDays,
            deliveryEstimateDays,
            variants: [
              {
                name: text(row, "variantName") || "Default",
                skuCode,
                barcode: text(row, "barcode"),
                sizeValue,
                sizeUnit: text(row, "sizeUnit"),
                packQuantity,
                packagingType: text(row, "packagingType"),
                taxCategoryId,
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
            isActive: hasValue(row, "isActive") ? parseBool(row.isActive, true) : undefined,
            isFeatured: hasValue(row, "isFeatured") ? parseBool(row.isFeatured, false) : undefined,
            isVegetarian: hasValue(row, "isVegetarian") ? parseBool(row.isVegetarian, true) : undefined,
            isVegan: hasValue(row, "isVegan") ? parseBool(row.isVegan, false) : undefined,
            unlimitedQuantity: hasValue(row, "unlimitedQuantity") ? parseBool(row.unlimitedQuantity, true) : undefined,
            sellIndependently: hasValue(row, "sellIndependently") ? parseBool(row.sellIndependently, true) : undefined,
            status,
            childProducts: childLinks,
            foodType: text(row, "foodType"),
            dietaryTags: hasValue(row, "dietaryTags") ? splitList(row.dietaryTags) : undefined,
            servingSize: text(row, "servingSize"),
            shelfLife: text(row, "shelfLife"),
            unit: text(row, "unit"),
            weight,
            variants: variantStatus
              ? [{ variantId: createdProduct.variants[0].variantId, status: variantStatus }]
              : undefined,
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
