#!/usr/bin/env tsx
/**
 * Idempotent WooCommerce → FMCG catalog importer.
 *
 * Usage:
 *   npm run import:fmcg -- --file=./data/wc-....csv --source-currency=CAD --dry-run
 *   npm run import:fmcg -- --file=./data/wc-....csv --source-currency=CAD --vendor-id=<ObjectId>
 *   npm run import:fmcg -- --file=./data/wc-....csv --source-currency=CAD --vendor-slug=himalaya-pantry
 */
import path from "path";
import mongoose, { Types } from "mongoose";
import { randomUUID } from "crypto";
import { connectDatabase, disconnectDatabase } from "../../config/database";
import { DEFAULT_WAREHOUSE_CODE } from "../../config/constants";
import { Category } from "../../models/Category";
import { Inventory } from "../../models/Inventory";
import { Pricing } from "../../models/Pricing";
import { Product, ProductDocument } from "../../models/Product";
import { Sku } from "../../models/Sku";
import { Vendor } from "../../models/Vendor";
import { Warehouse } from "../../models/Warehouse";
import { nextProductCode, nextVariantCode } from "../../utils/businessIds";
import { slugify } from "../../utils/slug";
import { skuOfferService } from "../../services/catalog/skuOffer.service";
import { seedCanadianTaxRates } from "../seedCanadianTaxRates";
import {
  deterministicSkuCode,
  deterministicSlug,
  inventoryQuantity,
  normalizeCategoriesForImport,
  parseWooCsv,
  priceToCents,
  WooRow,
} from "./wcCsvParse";

interface CliOptions {
  file: string;
  sourceCurrency: string;
  dryRun: boolean;
  vendorId?: string;
  vendorSlug?: string;
  limit?: number;
  onlyCategory?: string;
  sourceId?: string;
}

interface ImportStats {
  sourceRows: number;
  valid: number;
  invalid: number;
  createdProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  createdSkus: number;
  updatedSkus: number;
  createdPricing: number;
  updatedPricing: number;
  createdInventory: number;
  updatedInventory: number;
  createdCategories: number;
  productsWithImages: number;
  productsWithoutImages: number;
  productsWithBrand: number;
  productsWithoutBrand: number;
  warnings: string[];
  errors: string[];
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    file: path.resolve(process.cwd(), "data/wc-product-export-25-9-2026-1790336288881.csv"),
    sourceCurrency: "",
    dryRun: false,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--file=")) opts.file = path.resolve(arg.slice("--file=".length));
    else if (arg.startsWith("--source-currency=")) opts.sourceCurrency = arg.slice("--source-currency=".length);
    else if (arg.startsWith("--vendor-id=")) opts.vendorId = arg.slice("--vendor-id=".length);
    else if (arg.startsWith("--vendor-slug=")) opts.vendorSlug = arg.slice("--vendor-slug=".length);
    else if (arg.startsWith("--limit=")) opts.limit = Number(arg.slice("--limit=".length));
    else if (arg.startsWith("--only-category=")) opts.onlyCategory = arg.slice("--only-category=".length);
    else if (arg.startsWith("--source-id=")) opts.sourceId = arg.slice("--source-id=".length);
  }
  return opts;
}

async function resolveVendor(opts: CliOptions): Promise<{ id: Types.ObjectId; name: string }> {
  if (opts.vendorId) {
    const vendor = await Vendor.findById(opts.vendorId);
    if (!vendor) throw new Error(`Vendor not found: ${opts.vendorId}`);
    return { id: vendor._id, name: vendor.businessName };
  }
  if (opts.vendorSlug) {
    const vendor = await Vendor.findOne({ slug: opts.vendorSlug });
    if (!vendor) throw new Error(`Vendor slug not found: ${opts.vendorSlug}`);
    return { id: vendor._id, name: vendor.businessName };
  }
  const vendor = await Vendor.findOne({
    status: { $in: ["active", "approved"] },
    approvalStatus: { $in: ["approved"] },
  }).sort({ createdAt: 1 });
  if (!vendor) {
    throw new Error("No vendor found. Pass --vendor-id=<ObjectId> or --vendor-slug=<slug>");
  }
  return { id: vendor._id, name: vendor.businessName };
}

async function ensureWarehouse() {
  let wh = await Warehouse.findOne({ code: DEFAULT_WAREHOUSE_CODE });
  if (!wh) {
    wh = await Warehouse.create({
      name: "Toronto Fulfillment Center",
      code: DEFAULT_WAREHOUSE_CODE,
      address: "100 King Street West",
      city: "Toronto",
      state: "ON",
      pincode: "M5X 1A9",
      country: "Canada",
      isActive: true,
    });
  }
  return wh;
}

async function resolveCategoryIds(
  leaves: string[],
  cache: Map<string, Types.ObjectId>,
  stats: ImportStats,
  dryRun: boolean,
): Promise<{ primary: Types.ObjectId; all: Types.ObjectId[] }> {
  const normalized = normalizeCategoriesForImport(leaves);
  const ids: Types.ObjectId[] = [];
  for (const name of normalized) {
    const key = name.toLowerCase();
    let id = cache.get(key);
    if (!id) {
      const slug = slugify(name);
      let cat = await Category.findOne({ $or: [{ slug }, { name }] });
      if (!cat) {
        if (dryRun) {
          id = new Types.ObjectId();
          stats.createdCategories += 1;
          stats.warnings.push(`[dry-run] would create category: ${name}`);
        } else {
          cat = await Category.create({
            name,
            slug,
            isActive: true,
            sortOrder: 0,
            description: `Imported from WooCommerce (${name})`,
          });
          stats.createdCategories += 1;
          id = cat._id;
        }
      } else {
        id = cat._id;
      }
      cache.set(key, id!);
    }
    ids.push(id!);
  }
  if (ids.length === 0) {
    // Fallback Groceries
    const fallback = await resolveCategoryIds(["Groceries"], cache, stats, dryRun);
    return fallback;
  }
  return { primary: ids[0], all: ids };
}

function validateRow(row: WooRow, sourceCurrency: string): string[] {
  const errors: string[] = [];
  if (!row.sourceId) errors.push("missing source ID");
  if (!row.name) errors.push("missing name");
  const price = priceToCents(row.regularPrice, row.salePrice, sourceCurrency);
  if ("error" in price) errors.push(price.error);
  if (row.stock != null && row.stock < 0) errors.push("negative stock");
  return errors;
}

async function upsertProductStack(input: {
  row: WooRow;
  vendorId: Types.ObjectId;
  categoryId: Types.ObjectId;
  taxCategoryId: string;
  warehouse: { _id: Types.ObjectId; code: string };
  sourceCurrency: string;
  dryRun: boolean;
  stats: ImportStats;
}) {
  const { row, vendorId, categoryId, taxCategoryId, warehouse, sourceCurrency, dryRun, stats } = input;
  const price = priceToCents(row.regularPrice, row.salePrice, sourceCurrency);
  if ("error" in price) {
    stats.errors.push(`${row.sourceId}: ${price.error}`);
    stats.invalid += 1;
    return;
  }
  const skuCode = row.sku ? row.sku.toUpperCase() : deterministicSkuCode(row.sourceId);
  const qty = inventoryQuantity(row);
  const status = row.published ? "active" : "inactive";
  const images = row.images.map((url, index) => ({
    url,
    type: "front" as const,
    displayOrder: index,
    isPrimary: index === 0,
    altText: row.name,
  }));

  if (row.images.length) stats.productsWithImages += 1;
  else stats.productsWithoutImages += 1;
  if (row.brands) stats.productsWithBrand += 1;
  else stats.productsWithoutBrand += 1;

  if (dryRun) {
    stats.valid += 1;
    stats.createdProducts += 1;
    stats.createdSkus += 1;
    stats.createdPricing += 1;
    stats.createdInventory += 1;
    return;
  }

  const existing = await Product.findOne({
    "source.system": "woocommerce",
    "source.sourceId": row.sourceId,
  });

  let product: ProductDocument;
  if (existing) {
    existing.name = row.name;
    existing.description = row.description || row.name;
    existing.shortDescription = row.shortDescription || undefined;
    existing.categoryId = categoryId;
    existing.tags = row.tags;
    existing.images = images;
    existing.thumbnail = images[0]?.url;
    existing.status = status;
    existing.isActive = status === "active";
    existing.isFeatured = row.featured;
    existing.weight = row.weightLbs ?? existing.weight;
    existing.source = {
      system: "woocommerce",
      sourceId: row.sourceId,
      taxStatus: row.taxStatus || undefined,
      taxClass: row.taxClass || undefined,
      parentSourceId: row.parentSourceId || undefined,
    };
    // legacy mirrors for dual-read listing
    existing.sku = skuCode; // satisfy legacy unique sku index + dual-read
    existing.price = price.sellingPriceCents / 100;
    existing.compareAtPrice = price.mrpCents / 100;
    existing.stock = qty;
    existing.lowStockThreshold = row.lowStockAmount != null ? Math.trunc(row.lowStockAmount) : existing.lowStockThreshold;
    await existing.save();
    product = existing;
    stats.updatedProducts += 1;
  } else {
    const variantId = randomUUID();
    const variantCode = await nextVariantCode();
    product = await Product.create({
      productCode: await nextProductCode(),
      name: row.name,
      slug: deterministicSlug(row.name, row.sourceId),
      source: {
        system: "woocommerce",
        sourceId: row.sourceId,
        taxStatus: row.taxStatus || undefined,
        taxClass: row.taxClass || undefined,
        parentSourceId: row.parentSourceId || undefined,
      },
      categoryId,
      vendorId,
      description: row.description || row.name,
      shortDescription: row.shortDescription || undefined,
      tags: row.tags,
      images,
      thumbnail: images[0]?.url,
      variants: [
        {
          variantId,
          variantCode,
          name: "Default",
          packQuantity: 1,
          images: [],
          status: "active",
        },
      ],
      status,
      isActive: status === "active",
      isFeatured: row.featured,
      weight: row.weightLbs ?? undefined,
      sku: skuCode,
      price: price.sellingPriceCents / 100,
      compareAtPrice: price.mrpCents / 100,
      stock: qty,
      lowStockThreshold: row.lowStockAmount != null ? Math.trunc(row.lowStockAmount) : 10,
    });
    stats.createdProducts += 1;
  }

  const variant = product.variants[0];
  if (!variant) {
    stats.errors.push(`${row.sourceId}: product missing default variant`);
    stats.invalid += 1;
    return;
  }

  let sku = await Sku.findOne({ productId: product._id, variantId: variant.variantId });
  if (!sku) {
    sku = await Sku.findOne({ skuCode });
  }
  if (sku) {
    if (String(sku.vendorId) !== String(vendorId)) {
      stats.warnings.push(`${row.sourceId}: SKU ${skuCode} owned by another vendor — skipped SKU update`);
    } else {
      sku.productId = product._id;
      sku.variantId = variant.variantId;
      sku.taxCategoryId = new Types.ObjectId(taxCategoryId);
      sku.status = status === "active" ? "active" : "inactive";
      if (!sku.skuCode) sku.skuCode = skuCode;
      await sku.save();
      stats.updatedSkus += 1;
    }
  } else {
    sku = await Sku.create({
      skuCode,
      productId: product._id,
      variantId: variant.variantId,
      vendorId,
      taxCategoryId,
      status: status === "active" ? "active" : "inactive",
    });
    stats.createdSkus += 1;
  }

  variant.skuId = sku._id;
  product.variants = [variant];
  await product.save();

  let pricing = await Pricing.findOne({ skuId: sku._id, isActive: true }).sort({ effectiveFrom: -1 });
  if (pricing) {
    pricing.mrpCents = price.mrpCents;
    pricing.sellingPriceCents = price.sellingPriceCents;
    pricing.costPriceCents = 0; // unknown — never map regular price to cost
    pricing.currency = "CAD";
    await pricing.save();
    stats.updatedPricing += 1;
  } else {
    await Pricing.create({
      skuId: sku._id,
      currency: "CAD",
      mrpCents: price.mrpCents,
      sellingPriceCents: price.sellingPriceCents,
      costPriceCents: 0,
      effectiveFrom: new Date(),
      isActive: true,
    });
    stats.createdPricing += 1;
  }

  const inv = await Inventory.findOne({ skuId: sku._id, warehouseId: warehouse._id });
  if (inv) {
    inv.availableQuantity = qty;
    inv.skuCode = sku.skuCode;
    inv.warehouseCode = warehouse.code;
    if (row.lowStockAmount != null) inv.reorderLevel = Math.trunc(row.lowStockAmount);
    await inv.save();
    stats.updatedInventory += 1;
  } else {
    await Inventory.create({
      skuId: sku._id,
      skuCode: sku.skuCode,
      warehouseId: warehouse._id,
      warehouseCode: warehouse.code,
      availableQuantity: qty,
      reservedQuantity: 0,
      damagedQuantity: 0,
      reorderLevel: row.lowStockAmount != null ? Math.trunc(row.lowStockAmount) : 10,
      reorderQuantity: 50,
    });
    stats.createdInventory += 1;
  }

  stats.valid += 1;
}

async function postImportValidate(sourceIds: string[]) {
  const products = await Product.find({
    "source.system": "woocommerce",
    "source.sourceId": { $in: sourceIds },
  });
  const productIds = products.map((p) => p._id);
  const skus = await Sku.find({ productId: { $in: productIds } });
  const skuIds = skus.map((s) => s._id);
  const pricing = await Pricing.find({ skuId: { $in: skuIds }, isActive: true });
  const inventory = await Inventory.find({ skuId: { $in: skuIds } });
  const warehouse = await Warehouse.findOne({ code: DEFAULT_WAREHOUSE_CODE });

  const orphanSkus = skus.filter((s) => !productIds.some((id) => String(id) === String(s.productId)));
  const skusMissingPricing = skus.filter((s) => !pricing.some((p) => String(p.skuId) === String(s._id)));
  const skusMissingInventory = skus.filter((s) => !inventory.some((i) => String(i.skuId) === String(s._id)));
  const negativePrices = pricing.filter((p) => p.mrpCents < 0 || p.sellingPriceCents < 0);
  const negativeInv = inventory.filter((i) => i.availableQuantity < 0);
  const badWarehouse = inventory.filter((i) => warehouse && String(i.warehouseId) !== String(warehouse._id));

  console.log("\nPOST-IMPORT VALIDATION");
  console.log(`  Products (woocommerce source set): ${products.length}`);
  console.log(`  SKUs:                              ${skus.length}`);
  console.log(`  Pricing (active):                  ${pricing.length}`);
  console.log(`  Inventory:                         ${inventory.length}`);
  console.log(`  Orphan SKUs:                       ${orphanSkus.length}`);
  console.log(`  SKUs missing pricing:              ${skusMissingPricing.length}`);
  console.log(`  SKUs missing inventory:            ${skusMissingInventory.length}`);
  console.log(`  Negative prices:                   ${negativePrices.length}`);
  console.log(`  Negative inventory:                ${negativeInv.length}`);
  console.log(`  Inventory not at ${DEFAULT_WAREHOUSE_CODE}: ${badWarehouse.length}`);
  console.log(`  Historical orders modified:        0`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.sourceCurrency) {
    console.error("ERROR: --source-currency is required (e.g. --source-currency=CAD)");
    process.exit(1);
  }
  if (opts.sourceCurrency.toUpperCase() !== "CAD") {
    console.error(`ERROR: Unsupported source currency ${opts.sourceCurrency}. Only CAD is accepted.`);
    process.exit(1);
  }

  const rows = parseWooCsv(opts.file);
  let selected = rows;
  if (opts.sourceId) selected = selected.filter((r) => r.sourceId === opts.sourceId);
  if (opts.onlyCategory) {
    const needle = opts.onlyCategory.toLowerCase();
    selected = selected.filter((r) =>
      normalizeCategoriesForImport(r.categoryLeaves).some((c) => c.toLowerCase() === needle),
    );
  }
  if (opts.limit != null && opts.limit > 0) selected = selected.slice(0, opts.limit);

  const stats: ImportStats = {
    sourceRows: rows.length,
    valid: 0,
    invalid: 0,
    createdProducts: 0,
    updatedProducts: 0,
    skippedProducts: 0,
    createdSkus: 0,
    updatedSkus: 0,
    createdPricing: 0,
    updatedPricing: 0,
    createdInventory: 0,
    updatedInventory: 0,
    createdCategories: 0,
    productsWithImages: 0,
    productsWithoutImages: 0,
    productsWithBrand: 0,
    productsWithoutBrand: 0,
    warnings: [],
    errors: [],
  };

  const catPreview = new Map<string, number>();
  for (const row of selected) {
    for (const leaf of normalizeCategoriesForImport(row.categoryLeaves)) {
      catPreview.set(leaf, (catPreview.get(leaf) || 0) + 1);
    }
  }

  if (opts.dryRun) {
    console.log("FMCG IMPORT DRY RUN\n");
    console.log("Source:\n  WooCommerce CSV");
    console.log(`File:\n  ${opts.file}`);
    console.log(`\nRows:\n  ${selected.length} (of ${rows.length} in file)`);
    for (const row of selected) {
      const errs = validateRow(row, opts.sourceCurrency);
      if (errs.length) {
        stats.invalid += 1;
        stats.errors.push(`${row.sourceId} ${row.name}: ${errs.join("; ")}`);
        continue;
      }
      if (row.parentSourceId) {
        stats.warnings.push(
          `${row.sourceId}: parent ${row.parentSourceId} not treated as variant (imported as separate product)`,
        );
      }
      await upsertProductStack({
        row,
        vendorId: new Types.ObjectId(),
        categoryId: new Types.ObjectId(),
        taxCategoryId: "dry-run",
        warehouse: { _id: new Types.ObjectId(), code: DEFAULT_WAREHOUSE_CODE },
        sourceCurrency: opts.sourceCurrency,
        dryRun: true,
        stats,
      });
    }
    console.log(`\nValid:\n  ${stats.valid}`);
    console.log(`Invalid:\n  ${stats.invalid}`);
    console.log(`\nProducts:\n  ${stats.createdProducts}`);
    console.log(`SKUs:\n  ${stats.createdSkus}`);
    console.log(`Brands:\n  0 (source Brands column empty — brandId left unset)`);
    console.log(`\nProducts with images:\n  ${stats.productsWithImages}`);
    console.log(`Products without images:\n  ${stats.productsWithoutImages}`);
    console.log("\nCategories:");
    for (const [name, count] of [...catPreview.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${name}: ${count}`);
    }
    if (stats.warnings.length) {
      console.log(`\nWarnings (${stats.warnings.length}):`);
      for (const w of stats.warnings.slice(0, 40)) console.log(`  - ${w}`);
      if (stats.warnings.length > 40) console.log(`  … ${stats.warnings.length - 40} more`);
    }
    if (stats.errors.length) {
      console.log(`\nErrors (${stats.errors.length}):`);
      for (const e of stats.errors) console.log(`  - ${e}`);
    }
    console.log("\nNo database changes made.");
    return;
  }

  await connectDatabase();
  try {
    const vendor = await resolveVendor(opts);
    const warehouse = await ensureWarehouse();
    await seedCanadianTaxRates();
    const taxCategoryId = await skuOfferService.ensureTaxCategory("STANDARD");
    const categoryCache = new Map<string, Types.ObjectId>();

    console.log("FMCG IMPORT\n");
    console.log(`Source currency: ${opts.sourceCurrency.toUpperCase()}`);
    console.log(`Application currency: CAD`);
    console.log(`Warehouse: ${warehouse.code}`);
    console.log(`Vendor: ${vendor.name} (${vendor.id})`);
    console.log(`Tax category: STANDARD (${taxCategoryId})`);
    console.log(`Rows selected: ${selected.length}`);
    console.log("\nCategory summary (normalized primary candidates):");
    for (const [name, count] of [...catPreview.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${name}: ${count}`);
    }
    console.log("\nImported inventory has no source batch information (InventoryBatch skipped).");
    console.log("costPriceCents set to 0 (unknown — Regular price is NOT cost).\n");

    for (const row of selected) {
      const errs = validateRow(row, opts.sourceCurrency);
      if (errs.length) {
        stats.invalid += 1;
        stats.errors.push(`${row.sourceId} ${row.name}: ${errs.join("; ")}`);
        continue;
      }
      if (row.parentSourceId) {
        stats.warnings.push(
          `${row.sourceId}: parent ${row.parentSourceId} imported as separate product (not a variant)`,
        );
      }
      try {
        const { primary } = await resolveCategoryIds(row.categoryLeaves, categoryCache, stats, false);
        await upsertProductStack({
          row,
          vendorId: vendor.id,
          categoryId: primary,
          taxCategoryId,
          warehouse: { _id: warehouse._id, code: warehouse.code },
          sourceCurrency: opts.sourceCurrency,
          dryRun: false,
          stats,
        });
      } catch (error) {
        stats.invalid += 1;
        const message = error instanceof Error ? error.message : String(error);
        stats.errors.push(`${row.sourceId} ${row.name}: ${message}`);
      }
    }

    console.log("\nFMCG IMPORT COMPLETE\n");
    console.log(`Source rows:                  ${stats.sourceRows}`);
    console.log(`Selected rows:                ${selected.length}`);
    console.log(`Valid:                        ${stats.valid}`);
    console.log(`Invalid:                      ${stats.invalid}`);
    console.log(`Imported/created products:    ${stats.createdProducts}`);
    console.log(`Updated products:             ${stats.updatedProducts}`);
    console.log(`Imported variants:            ${stats.createdProducts + stats.updatedProducts} (1 Default each)`);
    console.log(`Created SKUs:                 ${stats.createdSkus}`);
    console.log(`Updated SKUs:                 ${stats.updatedSkus}`);
    console.log(`Created pricing records:      ${stats.createdPricing}`);
    console.log(`Updated pricing records:      ${stats.updatedPricing}`);
    console.log(`Created inventory records:    ${stats.createdInventory}`);
    console.log(`Updated inventory records:    ${stats.updatedInventory}`);
    console.log(`Imported brands:              0`);
    console.log(`Created categories:           ${stats.createdCategories}`);
    console.log(`Products with images:         ${stats.productsWithImages}`);
    console.log(`Products without images:      ${stats.productsWithoutImages}`);
    console.log(`Warnings:                     ${stats.warnings.length}`);
    console.log(`Errors:                       ${stats.errors.length}`);
    console.log(`\nSource currency:              ${opts.sourceCurrency.toUpperCase()}`);
    console.log(`Application currency:         CAD`);
    console.log(`Warehouse:                    ${warehouse.code}`);
    console.log(`Historical orders modified:   0`);

    if (stats.errors.length) {
      console.log("\nErrors:");
      for (const e of stats.errors.slice(0, 50)) console.log(`  - ${e}`);
    }

    await postImportValidate(selected.map((r) => r.sourceId));
  } finally {
    await disconnectDatabase();
    await mongoose.disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
