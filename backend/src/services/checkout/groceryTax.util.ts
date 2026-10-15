import { Types } from "mongoose";
import { Category } from "../../models/Category";
import { Product } from "../../models/Product";

export function looksLikeGroceryCategory(category: { name?: string; slug?: string }): boolean {
  const hay = `${category.slug || ""} ${category.name || ""}`.toLowerCase();
  return /\bgrocer/.test(hay);
}

/**
 * A product is a grocery if any of its categories (or ancestors) looks like Groceries.
 */
export async function resolveGroceryProductIds(productIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(productIds.filter(Boolean))];
  const groceryIds = new Set<string>();
  if (!unique.length) return groceryIds;

  const products = await Product.find({ _id: { $in: unique } })
    .select("_id categoryId categoryIds")
    .lean();

  const categoryIdSet = new Set<string>();
  for (const product of products) {
    if (product.categoryId) categoryIdSet.add(String(product.categoryId));
    for (const id of product.categoryIds || []) {
      if (id) categoryIdSet.add(String(id));
    }
  }

  if (!categoryIdSet.size) return groceryIds;

  // Load referenced categories and walk parents until roots are resolved.
  const categoryMap = new Map<
    string,
    { _id: Types.ObjectId; name: string; slug: string; parentId?: Types.ObjectId | null }
  >();
  let pending = [...categoryIdSet];
  while (pending.length) {
    const batch = pending.filter((id) => !categoryMap.has(id));
    pending = [];
    if (!batch.length) break;
    const rows = await Category.find({ _id: { $in: batch } })
      .select("_id name slug parentId")
      .lean();
    for (const row of rows) {
      const id = String(row._id);
      categoryMap.set(id, row);
      if (row.parentId) {
        const parentId = String(row.parentId);
        if (!categoryMap.has(parentId)) pending.push(parentId);
      }
    }
  }

  const isGroceryCategoryId = (categoryId: string, seen = new Set<string>()): boolean => {
    if (!categoryId || seen.has(categoryId)) return false;
    seen.add(categoryId);
    const cat = categoryMap.get(categoryId);
    if (!cat) return false;
    if (looksLikeGroceryCategory(cat)) return true;
    if (cat.parentId) return isGroceryCategoryId(String(cat.parentId), seen);
    return false;
  };

  for (const product of products) {
    const ids = [
      product.categoryId ? String(product.categoryId) : "",
      ...(product.categoryIds || []).map((id) => String(id)),
    ].filter(Boolean);
    if (ids.some((id) => isGroceryCategoryId(id))) {
      groceryIds.add(String(product._id));
    }
  }

  return groceryIds;
}

/** Build tax line inputs for grocery / mixed cart rules. */
export function buildGroceryAwareTaxLines(input: {
  lines: Array<{
    skuId: string;
    productId: string;
    lineTotalCents: number;
    taxCategoryId?: string;
    isGrocery: boolean;
  }>;
  subtotalCents: number;
  discountPoolCents: number;
  platformFeeCents: number;
  deliveryFeeCents: number;
}): {
  taxLines: Array<{ skuId: string; taxCategoryId?: string; taxableAmountCents: number }>;
  groceryOnlyCart: boolean;
  hasGrocery: boolean;
  hasNonGrocery: boolean;
  excludedGroceryAmountCents: number;
  deliveryFeeTaxed: boolean;
} {
  const hasGrocery = input.lines.some((line) => line.isGrocery);
  const hasNonGrocery = input.lines.some((line) => !line.isGrocery);
  const groceryOnlyCart = hasGrocery && !hasNonGrocery;

  let excludedGroceryAmountCents = 0;
  const taxLines: Array<{ skuId: string; taxCategoryId?: string; taxableAmountCents: number }> = [];

  for (const line of input.lines) {
    const share =
      input.subtotalCents > 0
        ? Math.round((line.lineTotalCents / input.subtotalCents) * input.discountPoolCents)
        : 0;
    const amount = Math.max(0, Math.trunc(line.lineTotalCents - share));
    if (line.isGrocery) {
      excludedGroceryAmountCents += amount;
      continue;
    }
    taxLines.push({
      skuId: line.skuId || line.productId,
      taxCategoryId: line.taxCategoryId,
      taxableAmountCents: amount,
    });
  }

  if (input.platformFeeCents > 0) {
    taxLines.push({
      skuId: "__platform_fee__",
      taxableAmountCents: input.platformFeeCents,
    });
  }

  // Delivery is taxable only when the cart has non-grocery items.
  const deliveryFeeTaxed = hasNonGrocery && input.deliveryFeeCents > 0;
  if (deliveryFeeTaxed) {
    taxLines.push({
      skuId: "__delivery_fee__",
      taxableAmountCents: input.deliveryFeeCents,
    });
  }

  return {
    taxLines,
    groceryOnlyCart,
    hasGrocery,
    hasNonGrocery,
    excludedGroceryAmountCents,
    deliveryFeeTaxed,
  };
}
