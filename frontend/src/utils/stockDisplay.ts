export type StockDisplayTone = "green" | "yellow" | "red";

export type StockDisplay = {
  label: string;
  tone: StockDisplayTone;
  inStock: boolean;
};

/**
 * Product detail stock messaging.
 * Unlimited → always "In stock".
 * Tracked stock uses admin thresholds (defaults: low=5, inStock=10).
 */
export function resolveStockDisplay(input: {
  unlimitedQuantity?: boolean | null;
  stock?: number | null;
  lowStockDisplayThreshold?: number | null;
  inStockDisplayThreshold?: number | null;
}): StockDisplay {
  if (input.unlimitedQuantity !== false) {
    return { label: "In stock", tone: "green", inStock: true };
  }

  const stock = Math.max(0, Math.trunc(Number(input.stock) || 0));
  const lowThreshold = Math.max(0, Math.trunc(Number(input.lowStockDisplayThreshold) || 5));
  const inStockThreshold = Math.max(
    lowThreshold,
    Math.trunc(Number(input.inStockDisplayThreshold) || 10),
  );

  if (stock <= 0) {
    return { label: "Currently Out of stock", tone: "red", inStock: false };
  }
  if (stock <= lowThreshold) {
    return { label: `${stock} available`, tone: "yellow", inStock: true };
  }
  if (stock > inStockThreshold) {
    return { label: "In stock", tone: "green", inStock: true };
  }
  return { label: `${stock} available`, tone: "green", inStock: true };
}
