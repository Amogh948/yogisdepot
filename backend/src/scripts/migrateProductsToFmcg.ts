/**
 * Idempotent migration: flat Product → Brand + Product variants + Sku + Pricing + Inventory at YYZ-WH-01.
 * Remaps cart productId → skuId when possible.
 * Converts coupon min/max to cents when missing.
 *
 * Usage: npm run migrate:fmcg
 */
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { env } from "../config/env";
import { Brand } from "../models/Brand";
import { Cart } from "../models/Cart";
import { Coupon } from "../models/Coupon";
import { Pricing } from "../models/Pricing";
import { Product } from "../models/Product";
import { Sku } from "../models/Sku";
import { Warehouse } from "../models/Warehouse";
import { nextProductCode, nextVariantCode } from "../utils/businessIds";
import { dollarsToCents } from "../utils/money";
import { uniqueSlug } from "../utils/slug";
import { inventoryReservationService } from "../services/inventory/inventoryReservation.service";
import { skuOfferService } from "../services/catalog/skuOffer.service";
import { seedCanadianTaxRates } from "./seedCanadianTaxRates";
import { DEFAULT_WAREHOUSE_CODE } from "../config/constants";

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

async function migrate() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected. Starting FMCG migration…");

  const warehouse = await ensureWarehouse();
  const taxSeed = await seedCanadianTaxRates();
  console.log("Tax rates seeded:", taxSeed);

  const taxCategoryId = await skuOfferService.ensureTaxCategory("STANDARD");
  const products = await Product.find();
  let migrated = 0;
  let skipped = 0;

  for (const product of products) {
    const existingSku = await Sku.findOne({ productId: product._id });
    if (existingSku) {
      skipped += 1;
      continue;
    }

    if (!product.productCode) {
      product.productCode = await nextProductCode();
    }

    if (product.brand && !product.brandId) {
      const slug = uniqueSlug(product.brand);
      let brand = await Brand.findOne({ slug });
      if (!brand) {
        brand = await Brand.create({ name: product.brand, slug, isActive: true });
      }
      product.brandId = brand._id;
    }

    // Coerce legacy string images
    const rawImages = product.get("images");
    if (Array.isArray(rawImages) && typeof (rawImages as unknown[])[0] === "string") {
      product.images = (rawImages as unknown as string[]).map((url, index) => ({
        url,
        type: "front" as const,
        displayOrder: index,
        isPrimary: index === 0,
      }));
    }

    const variantId = randomUUID();
    const variantCode = await nextVariantCode();
    product.variants = [
      {
        variantId,
        variantCode,
        name: product.unit || "Default",
        packQuantity: 1,
        images: [],
        status: "active",
      },
    ];
    product.status = product.isActive === false ? "inactive" : "active";

    const skuCode = (product.sku || `SKU-${String(product._id).slice(-8)}`).toUpperCase();
    const sku = await Sku.create({
      skuCode,
      productId: product._id,
      variantId,
      vendorId: product.vendorId,
      taxCategoryId,
      status: product.status === "active" ? "active" : "inactive",
    });
    product.variants[0].skuId = sku._id;

    const sellingPriceCents = dollarsToCents(product.price ?? 0);
    const mrpCents = dollarsToCents(product.compareAtPrice ?? product.price ?? 0);
    const costPriceCents = dollarsToCents(product.costPrice ?? 0);

    const pricingExists = await Pricing.findOne({ skuId: sku._id, isActive: true });
    if (!pricingExists) {
      await Pricing.create({
        skuId: sku._id,
        mrpCents,
        costPriceCents,
        sellingPriceCents,
        effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
        isActive: true,
      });
    }

    const stock = product.stock ?? 0;
    if (stock > 0) {
      await inventoryReservationService.ensureStockRow({
        skuId: String(sku._id),
        skuCode: sku.skuCode,
        warehouseId: warehouse._id,
        warehouseCode: warehouse.code,
        quantity: stock,
      });
    }

    await product.save();
    migrated += 1;
  }

  // Cart remap productId → skuId
  const carts = await Cart.find({ "items.productId": { $exists: true } });
  let cartItemsUpdated = 0;
  for (const cart of carts) {
    let dirty = false;
    for (const item of cart.items) {
      if (!item.skuId && item.productId) {
        const sku = await Sku.findOne({ productId: item.productId }).sort({ createdAt: 1 });
        if (sku) {
          item.skuId = sku._id;
          dirty = true;
          cartItemsUpdated += 1;
        }
      }
    }
    if (dirty) await cart.save();
  }

  // Coupon cents backfill
  const coupons = await Coupon.find();
  let couponsUpdated = 0;
  for (const coupon of coupons) {
    let dirty = false;
    if (!coupon.minimumOrderValueCents && coupon.minimumOrderValue) {
      coupon.minimumOrderValueCents = dollarsToCents(coupon.minimumOrderValue);
      dirty = true;
    }
    if (coupon.maximumDiscount != null && coupon.maximumDiscountCents == null) {
      coupon.maximumDiscountCents = dollarsToCents(coupon.maximumDiscount);
      dirty = true;
    }
    if (coupon.discountType === "fixed" && coupon.discountValue < 1000) {
      // Likely legacy dollars
      coupon.discountValue = dollarsToCents(coupon.discountValue);
      dirty = true;
    }
    if (dirty) {
      await coupon.save();
      couponsUpdated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        migrated,
        skipped,
        cartItemsUpdated,
        couponsUpdated,
        warehouse: warehouse.code,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
