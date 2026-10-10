#!/usr/bin/env tsx
/**
 * Idempotent backfill for product commerce display fields and Pricing MRP.
 *
 * For products missing return/delivery fields:
 *   - returnWindowDays = 0
 *   - deliveryEstimateDays = 5
 *
 * For active Pricing rows with mrpCents < sellingPriceCents (invalid):
 *   - set mrpCents = sellingPriceCents
 *
 * Usage:
 *   npm run migrate:commerce-fields -- --dry-run
 *   npm run migrate:commerce-fields
 */
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { Pricing } from "../models/Pricing";
import { Product } from "../models/Product";

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  await connectDatabase();

  let productsUpdated = 0;
  let productsSkipped = 0;
  let pricingUpdated = 0;
  let pricingSkipped = 0;

  const products = await Product.find({
    $or: [
      { returnWindowDays: { $exists: false } },
      { deliveryEstimateDays: { $exists: false } },
      { returnWindowDays: null },
      { deliveryEstimateDays: null },
    ],
  }).select("_id name returnWindowDays deliveryEstimateDays price compareAtPrice");

  for (const product of products) {
    const nextReturn = typeof product.returnWindowDays === "number" ? product.returnWindowDays : 0;
    const nextDelivery = typeof product.deliveryEstimateDays === "number" ? product.deliveryEstimateDays : 5;
    const needsReturn = typeof product.returnWindowDays !== "number";
    const needsDelivery = typeof product.deliveryEstimateDays !== "number";
    if (!needsReturn && !needsDelivery) {
      productsSkipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] product ${product._id} (${product.name}): return=${nextReturn}, delivery=${nextDelivery}`);
      productsUpdated += 1;
      continue;
    }
    if (needsReturn) product.returnWindowDays = nextReturn;
    if (needsDelivery) product.deliveryEstimateDays = Math.max(1, nextDelivery);
    await product.save();
    productsUpdated += 1;
  }

  const badPricing = await Pricing.find({
    isActive: true,
    $expr: { $lt: ["$mrpCents", "$sellingPriceCents"] },
  });

  for (const row of badPricing) {
    if (dryRun) {
      console.log(
        `[dry-run] pricing ${row._id}: mrp ${row.mrpCents} -> ${row.sellingPriceCents} (match selling)`,
      );
      pricingUpdated += 1;
      continue;
    }
    row.mrpCents = row.sellingPriceCents;
    await row.save();
    pricingUpdated += 1;
  }

  // Count already-valid pricing rows for logging
  pricingSkipped = await Pricing.countDocuments({
    isActive: true,
    $expr: { $gte: ["$mrpCents", "$sellingPriceCents"] },
  });

  console.log(
    JSON.stringify(
      {
        dryRun,
        productsUpdated,
        productsSkipped,
        pricingUpdated,
        pricingSkipped,
      },
      null,
      2,
    ),
  );

  await disconnectDatabase();
  await mongoose.disconnect().catch(() => undefined);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await disconnectDatabase();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
