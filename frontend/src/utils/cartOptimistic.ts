import type { Cart, Product } from "../types";
import { entityId } from "../types";

export function emptyCart(): Cart {
  return { id: "optimistic", items: [], subtotal: 0, itemCount: 0 };
}

/** Apply a set-quantity change locally (instant UI). */
export function applyOptimisticCart(cart: Cart, product: Product, quantity: number): Cart {
  const id = entityId(product);
  const unitPrice = product.price ?? 0;
  const items = cart.items.map((item) => ({ ...item }));
  const index = items.findIndex((item) => item.productId === id);

  if (quantity <= 0) {
    if (index >= 0) items.splice(index, 1);
  } else if (index >= 0) {
    items[index] = {
      ...items[index],
      quantity,
      lineTotal: unitPrice * quantity,
      inStock: (product.stock ?? items[index].inStock) ? true : items[index].inStock,
    };
  } else {
    items.push({
      productId: id,
      quantity,
      product,
      lineTotal: unitPrice * quantity,
      inStock: (product.stock ?? 0) > 0,
    });
  }

  return {
    ...cart,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}

/** Apply an add-delta change locally. */
export function applyOptimisticAdd(cart: Cart, product: Product, delta: number): Cart {
  const id = entityId(product);
  const current = cart.items.find((item) => item.productId === id)?.quantity ?? 0;
  return applyOptimisticCart(cart, product, current + delta);
}
