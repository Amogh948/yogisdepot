import type { Cart, Product } from "../types";
import { entityId } from "../types";

export function emptyCart(): Cart {
  return { id: "optimistic", items: [], subtotal: 0, itemCount: 0 };
}

function childChargePrice(parent: Product, childPrice: number): number {
  if (parent.addChildPricesToParent === false && (parent.price ?? 0) > 0) return 0;
  return childPrice;
}

function childCartLine(
  parent: Product,
  parentId: string,
  child: NonNullable<Product["childProducts"]>[number],
  quantity: number,
) {
  const price = childChargePrice(parent, child.price ?? 0);
  return {
    productId: child.productId,
    parentProductId: parentId,
    locked: true,
    quantity,
    lineTotal: price * quantity,
    inStock: true,
    product: {
      id: child.productId,
      name: child.name || "Included item",
      slug: "",
      description: "",
      sku: "",
      vendorId: "",
      categoryId: "",
      images: child.image ? [child.image] : [],
      thumbnail: child.image,
      price,
      discount: 0,
      stock: 99,
      lowStockThreshold: 0,
      unit: "",
      tags: [],
      isVegetarian: true,
      isVegan: false,
      isFeatured: false,
      isActive: true,
      rating: 0,
      reviewCount: 0,
    } as Product,
  };
}

/** Apply a set-quantity change locally (instant UI). */
export function applyOptimisticCart(cart: Cart, product: Product, quantity: number): Cart {
  const id = entityId(product);
  const unitPrice = product.price ?? 0;
  const previous = cart.items.find((item) => item.productId === id && !item.parentProductId);
  let items = cart.items.filter(
    (item) => item.parentProductId !== id && !(item.productId === id && !item.parentProductId),
  );

  if (quantity > 0) {
    items.push({
      productId: id,
      quantity,
      product,
      lineTotal: unitPrice * quantity,
      inStock: previous?.inStock ?? (product.stock ?? 0) > 0,
    });
    const children = product.childProducts || [];
    if (children.length) {
      for (const child of children) {
        const per = Math.max(1, Math.floor(child.quantity) || 1);
        items.push(childCartLine(product, id, child, quantity * per));
      }
    } else {
      items.push(...cart.items.filter((item) => item.parentProductId === id));
    }
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
  const current = cart.items.find((item) => item.productId === id && !item.parentProductId)?.quantity ?? 0;
  return applyOptimisticCart(cart, product, current + delta);
}
