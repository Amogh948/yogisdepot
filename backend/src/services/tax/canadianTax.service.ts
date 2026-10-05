import { BadRequestError } from "../../errors/AppError";
import {
  CA_PROVINCES,
  CaProvince,
  CaTaxComponent,
  CanadianTaxRate,
} from "../../models/CanadianTaxRate";
import { TaxCategory, Taxability } from "../../models/TaxCategory";
import { applyBps, clampNonNegativeCents } from "../../utils/money";

export interface TaxLineInput {
  skuId: string;
  taxCategoryId?: string | null;
  taxableAmountCents: number;
}

export interface TaxDestination {
  country?: string;
  state: string;
  postalCode?: string;
}

export interface CanadianTaxInput {
  shippingDestination: TaxDestination;
  transactionDate: Date;
  lineItems: TaxLineInput[];
}

export interface TaxComponentResult {
  type: CaTaxComponent;
  rateBps: number;
  taxableAmountCents: number;
  taxAmountCents: number;
}

export interface CanadianTaxResult {
  jurisdiction: string;
  components: TaxComponentResult[];
  taxableAmountCents: number;
  totalTaxCents: number;
}

function normalizeProvince(state: string): CaProvince {
  const raw = state.trim().toUpperCase();
  const aliases: Record<string, CaProvince> = {
    ONTARIO: "ON",
    "BRITISH COLUMBIA": "BC",
    ALBERTA: "AB",
    QUEBEC: "QC",
    MANITOBA: "MB",
    SASKATCHEWAN: "SK",
    "NOVA SCOTIA": "NS",
    "NEW BRUNSWICK": "NB",
    "NEWFOUNDLAND AND LABRADOR": "NL",
    "PRINCE EDWARD ISLAND": "PE",
    "NORTHWEST TERRITORIES": "NT",
    NUNAVUT: "NU",
    YUKON: "YT",
  };
  const code = (aliases[raw] || raw) as CaProvince;
  if (!CA_PROVINCES.includes(code)) {
    throw new BadRequestError(`Unsupported Canadian province/territory: ${state}`);
  }
  return code;
}

function rateAppliesToCategory(
  rate: { appliesToAllTaxable: boolean; taxCategoryIds: { toString(): string }[] },
  taxCategoryId: string | null | undefined,
): boolean {
  if (rate.appliesToAllTaxable) return true;
  if (!taxCategoryId) return false;
  return rate.taxCategoryIds.some((id) => String(id) === taxCategoryId);
}

export const canadianTaxService = {
  async calculate(input: CanadianTaxInput): Promise<CanadianTaxResult> {
    const country = (input.shippingDestination.country || "Canada").toLowerCase();
    if (!country.includes("canada") && country !== "ca") {
      throw new BadRequestError("Shipping destination must be in Canada for tax calculation");
    }
    const province = normalizeProvince(input.shippingDestination.state);
    const txnDate = input.transactionDate;

    const rates = await CanadianTaxRate.find({
      province,
      isActive: true,
      effectiveFrom: { $lte: txnDate },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: txnDate } }],
    }).lean();

    const categoryIds = [
      ...new Set(input.lineItems.map((l) => l.taxCategoryId).filter((id): id is string => Boolean(id))),
    ];
    const categories = await TaxCategory.find({ _id: { $in: categoryIds } }).lean();
    const taxabilityMap = new Map(categories.map((c) => [String(c._id), c.taxability as Taxability]));

    let taxableAmountCents = 0;
    const componentBuckets = new Map<string, TaxComponentResult>();

    for (const line of input.lineItems) {
      const amount = clampNonNegativeCents(line.taxableAmountCents);
      if (amount <= 0) continue;

      const taxability = line.taxCategoryId
        ? taxabilityMap.get(line.taxCategoryId) || "TAXABLE"
        : "TAXABLE";
      if (taxability === "EXEMPT" || taxability === "ZERO_RATED") {
        continue;
      }

      taxableAmountCents += amount;

      for (const rate of rates) {
        if (!rateAppliesToCategory(rate, line.taxCategoryId)) continue;
        const key = `${rate.component}:${rate.rateBps}`;
        const taxAmountCents = applyBps(amount, rate.rateBps);
        const existing = componentBuckets.get(key);
        if (existing) {
          existing.taxableAmountCents += amount;
          existing.taxAmountCents += taxAmountCents;
        } else {
          componentBuckets.set(key, {
            type: rate.component as CaTaxComponent,
            rateBps: rate.rateBps,
            taxableAmountCents: amount,
            taxAmountCents,
          });
        }
      }
    }

    const components = [...componentBuckets.values()];
    const totalTaxCents = components.reduce((sum, c) => sum + c.taxAmountCents, 0);

    return {
      jurisdiction: `CA-${province}`,
      components,
      taxableAmountCents,
      totalTaxCents,
    };
  },
};
