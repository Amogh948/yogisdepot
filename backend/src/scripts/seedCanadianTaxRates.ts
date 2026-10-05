import { CanadianTaxRate } from "../models/CanadianTaxRate";
import { TaxCategory } from "../models/TaxCategory";

/** Seed versioned Canadian tax rates (additive; skips if identical open-ended row exists). */
export async function seedCanadianTaxRates(effectiveFrom = new Date("2024-01-01T00:00:00.000Z")) {
  let standard = await TaxCategory.findOne({ code: "STANDARD" });
  if (!standard) {
    standard = await TaxCategory.create({
      name: "Standard taxable",
      code: "STANDARD",
      taxability: "TAXABLE",
      isActive: true,
    });
  }
  let grocery = await TaxCategory.findOne({ code: "GROCERY_ZERO" });
  if (!grocery) {
    grocery = await TaxCategory.create({
      name: "Basic groceries (zero-rated)",
      code: "GROCERY_ZERO",
      taxability: "ZERO_RATED",
      isActive: true,
    });
  }

  // Illustrative statutory defaults — admin can add new versions; do not mutate these rows in place.
  const rows: Array<{ province: string; component: string; rateBps: number }> = [
    { province: "ON", component: "HST", rateBps: 1300 },
    { province: "AB", component: "GST", rateBps: 500 },
    { province: "BC", component: "GST", rateBps: 500 },
    { province: "BC", component: "PST", rateBps: 700 },
    { province: "QC", component: "GST", rateBps: 500 },
    { province: "QC", component: "QST", rateBps: 997 },
    { province: "MB", component: "GST", rateBps: 500 },
    { province: "MB", component: "PST", rateBps: 700 },
    { province: "SK", component: "GST", rateBps: 500 },
    { province: "SK", component: "PST", rateBps: 600 },
    { province: "NS", component: "HST", rateBps: 1500 },
    { province: "NB", component: "HST", rateBps: 1500 },
    { province: "NL", component: "HST", rateBps: 1500 },
    { province: "PE", component: "HST", rateBps: 1500 },
    { province: "NT", component: "GST", rateBps: 500 },
    { province: "NU", component: "GST", rateBps: 500 },
    { province: "YT", component: "GST", rateBps: 500 },
  ];

  let created = 0;
  for (const row of rows) {
    const exists = await CanadianTaxRate.findOne({
      province: row.province,
      component: row.component,
      rateBps: row.rateBps,
      effectiveFrom,
      effectiveTo: null,
      isActive: true,
    });
    if (exists) continue;
    await CanadianTaxRate.create({
      ...row,
      effectiveFrom,
      effectiveTo: null,
      isActive: true,
      appliesToAllTaxable: true,
      taxCategoryIds: [],
    });
    created += 1;
  }
  return { created, taxCategoryIds: { standard: String(standard._id), grocery: String(grocery._id) } };
}
