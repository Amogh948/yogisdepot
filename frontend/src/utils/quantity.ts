/** Per-order cap when a product does not have unlimitedQuantity enabled. */
export const MAX_ORDER_QUANTITY = 99;
/** Selector ceiling when unlimited quantity is enabled (stock is not applicable). */
export const UNLIMITED_ORDER_QUANTITY = 9999;

/** Max selectable quantity for cart / PDP controls. */
export function maxOrderQuantity(product: {
  stock?: number | null;
  unlimitedQuantity?: boolean | null;
}): number {
  // Missing / undefined defaults to unlimited (checked by default for all products).
  if (product.unlimitedQuantity !== false) return UNLIMITED_ORDER_QUANTITY;
  const stock = Math.max(0, Number(product.stock) || 0);
  if (stock <= 0) return 1;
  return Math.min(MAX_ORDER_QUANTITY, stock);
}
