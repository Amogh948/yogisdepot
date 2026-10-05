#!/usr/bin/env tsx
/**
 * Read-only WooCommerce CSV audit. Does NOT connect to MongoDB.
 *
 * Usage: npm run import:fmcg:audit -- <csv-path>
 */
import path from "path";
import { parseImageUrls, parseWooCsv, WooRow } from "./wcCsvParse";

function main() {
  const csvPath = process.argv[2] || path.resolve(process.cwd(), "data/wc-product-export-25-9-2026-1790336288881.csv");
  const rows = parseWooCsv(csvPath);

  let published = 0;
  let unpublished = 0;
  let simple = 0;
  let otherTypes = 0;
  let withPrice = 0;
  let withoutPrice = 0;
  let withSku = 0;
  let withoutSku = 0;
  let withGtin = 0;
  let withImages = 0;
  let withoutImages = 0;
  let withCats = 0;
  let withoutCats = 0;
  let withBrands = 0;
  let withoutBrands = 0;
  let withParent = 0;
  let invalidImageUrls = 0;
  const nameCounts = new Map<string, number>();
  const idCounts = new Map<string, number>();
  const skuCounts = new Map<string, number>();
  const catCounts = new Map<string, number>();
  const invalidPrices: string[] = [];
  const invalidStock: string[] = [];
  const parents: WooRow[] = [];
  const idToName = new Map<string, string>();

  for (const row of rows) {
    idToName.set(row.sourceId, row.name);
    nameCounts.set(row.name, (nameCounts.get(row.name) || 0) + 1);
    idCounts.set(row.sourceId, (idCounts.get(row.sourceId) || 0) + 1);
    if (row.published) published += 1;
    else unpublished += 1;
    if (row.type === "simple") simple += 1;
    else otherTypes += 1;
    if (row.regularPrice != null && row.regularPrice >= 0) withPrice += 1;
    else {
      withoutPrice += 1;
      invalidPrices.push(`${row.sourceId} ${row.name}: regular=${row.raw["Regular price"]}`);
    }
    if (row.salePrice != null && row.salePrice < 0) {
      invalidPrices.push(`${row.sourceId} ${row.name}: sale=${row.raw["Sale price"]}`);
    }
    if (row.sku) {
      withSku += 1;
      skuCounts.set(row.sku, (skuCounts.get(row.sku) || 0) + 1);
    } else withoutSku += 1;
    if (row.gtin) withGtin += 1;
    if (row.images.length) withImages += 1;
    else withoutImages += 1;
    const imgCheck = parseImageUrls(row.raw["Images"] || "");
    invalidImageUrls += imgCheck.invalid.length;
    if (row.categoryLeaves.length) {
      withCats += 1;
      for (const leaf of row.categoryLeaves) {
        catCounts.set(leaf, (catCounts.get(leaf) || 0) + 1);
      }
    } else withoutCats += 1;
    if (row.brands) withBrands += 1;
    else withoutBrands += 1;
    if (row.parentSourceId) {
      withParent += 1;
      parents.push(row);
    }
    if (row.raw["Stock"] && row.stock == null) {
      invalidStock.push(`${row.sourceId} ${row.name}: stock=${row.raw["Stock"]}`);
    } else if (row.stock != null && row.stock < 0) {
      invalidStock.push(`${row.sourceId} ${row.name}: stock=${row.stock}`);
    }
  }

  const dupNames = [...nameCounts.entries()].filter(([, c]) => c > 1);
  const dupIds = [...idCounts.entries()].filter(([, c]) => c > 1 && Boolean(c));
  const dupSkus = [...skuCounts.entries()].filter(([, c]) => c > 1);

  console.log("FMCG CSV AUDIT (read-only — no MongoDB writes)\n");
  console.log(`File: ${csvPath}`);
  console.log(`Total rows: ${rows.length}`);
  console.log(`Published rows: ${published}`);
  console.log(`Unpublished rows: ${unpublished}`);
  console.log(`Simple products: ${simple}`);
  console.log(`Other product types: ${otherTypes}`);
  console.log(`Products with prices: ${withPrice}`);
  console.log(`Products without prices: ${withoutPrice}`);
  console.log(`Products with SKU: ${withSku}`);
  console.log(`Products without SKU: ${withoutSku}`);
  console.log(`Products with GTIN: ${withGtin}`);
  console.log(`Products without GTIN: ${rows.length - withGtin}`);
  console.log(`Products with images: ${withImages}`);
  console.log(`Products without images: ${withoutImages}`);
  console.log(`Invalid image URLs: ${invalidImageUrls}`);
  console.log(`Products with categories: ${withCats}`);
  console.log(`Products without categories: ${withoutCats}`);
  console.log(`Products with brands: ${withBrands}`);
  console.log(`Products without brands: ${withoutBrands}`);
  console.log(`Products with parent references: ${withParent}`);
  console.log(`Duplicate product names: ${dupNames.length}`);
  console.log(`Duplicate source IDs: ${dupIds.length}`);
  console.log(`Duplicate SKUs: ${dupSkus.length}`);
  console.log(`Invalid prices: ${invalidPrices.length}`);
  console.log(`Invalid stock values: ${invalidStock.length}`);
  console.log(`Unknown categories: (resolved at import against Category collection)`);

  console.log("\nCategory counts:");
  for (const [name, count] of [...catCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }

  if (parents.length) {
    console.log("\nParent rows:");
    for (const p of parents) {
      const parentName = idToName.get(p.parentSourceId) || "(not in export)";
      console.log(`  source ID: ${p.sourceId}`);
      console.log(`    name: ${p.name}`);
      console.log(`    parent ID: ${p.parentSourceId} (${parentName})`);
      console.log(`    price: ${p.regularPrice}`);
      console.log(`    category: ${p.categoriesRaw}`);
      console.log(`    attributes: color empty / not reliable`);
    }
    console.log("\nRecommendation: import parent-linked rows as separate products (parents missing from export).");
  }
}

main();
