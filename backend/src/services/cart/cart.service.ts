import { Types } from "mongoose";
import { MAX_ORDER_QUANTITY } from "../../config/constants";
import { BadRequestError, NotFoundError } from "../../errors/AppError";
import { Cart, type CartDocument, type CartItem } from "../../models/Cart";
import { Product } from "../../models/Product";
import { Sku } from "../../models/Sku";
import { inventoryReservationService } from "../inventory/inventoryReservation.service";
import { skuOfferService } from "../catalog/skuOffer.service";

/** Missing / undefined defaults to unlimited (checked by default for all products). */
function isUnlimitedQuantity(value?: boolean | null) {
  return value !== false;
}

function assertOrderQuantityAllowed(quantity: number, unlimitedQuantity?: boolean | null) {
  if (!isUnlimitedQuantity(unlimitedQuantity) && quantity > MAX_ORDER_QUANTITY) {
    throw new BadRequestError(`Maximum quantity per order is ${MAX_ORDER_QUANTITY}`);
  }
}

/**
 * Set included-product lines to parentQty × each child's quantity.
 * Children are one level deep and stay locked to this parent.
 */
async function syncChildLines(cart: CartDocument, parentProductId: string, parentQty: number) {
  const parent = await Product.findById(parentProductId).select("childProducts");
  const links = (parent?.childProducts || []).filter((link) => String(link.productId) !== parentProductId);
  const wanted = new Map<string, number>();
  for (const link of links) {
    const per = Math.max(1, Math.floor(Number(link.quantity) || 1));
    wanted.set(String(link.productId), parentQty * per);
  }

  cart.items = cart.items.filter((item) => {
    if (String(item.parentProductId || "") !== parentProductId) return true;
    return wanted.has(String(item.productId || ""));
  });

  for (const [childId, qty] of wanted) {
    const child = await Product.findById(childId).select("name isActive unlimitedQuantity stock");
    if (!child || child.isActive === false) {
      throw new BadRequestError("An included product is no longer available");
    }
    const sku = await skuOfferService.resolveSkuForProductId(childId);
    const existing = cart.items.find(
      (item) => String(item.parentProductId || "") === parentProductId && String(item.productId || "") === childId,
    );
    if (sku && !isUnlimitedQuantity(child.unlimitedQuantity)) {
      const others = cart.items.reduce((sum, item) => {
        if (existing && item === existing) return sum;
        if (String(item.skuId || "") === String(sku._id)) return sum + item.quantity;
        return sum;
      }, 0);
      const available = await inventoryReservationService.availableQuantity(String(sku._id));
      if (others + qty > available) {
        throw new BadRequestError(`${child.name} does not have enough stock to include with this item`);
      }
    } else if (!sku && !isUnlimitedQuantity(child.unlimitedQuantity) && qty > (child.stock ?? 0)) {
      throw new BadRequestError(`${child.name} does not have enough stock to include with this item`);
    }
    assertOrderQuantityAllowed(qty, child.unlimitedQuantity);
    if (existing) {
      existing.quantity = qty;
      if (sku) existing.skuId = sku._id;
    } else {
      cart.items.push({
        productId: child._id,
        skuId: sku?._id,
        quantity: qty,
        parentProductId: new Types.ObjectId(parentProductId),
      });
    }
  }
}

export const cartService = {
  async getOrCreate(userId: string) {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }
    return cart;
  },

  async getHydrated(userId: string) {
    const cart = await this.getOrCreate(userId);
    const items = [];
    for (const item of cart.items) {
      let skuId = item.skuId ? String(item.skuId) : "";
      if (!skuId && item.productId) {
        const resolved = await skuOfferService.resolveSkuForProductId(String(item.productId));
        if (resolved) skuId = String(resolved._id);
      }
      if (skuId) {
        try {
          const offer = await skuOfferService.getOfferBySkuId(skuId);
          items.push({
            skuId: offer.skuId,
            productId: offer.productId,
            quantity: item.quantity,
            product: {
              id: offer.productId,
              name: offer.name,
              slug: offer.slug,
              thumbnail: offer.images[0],
              images: offer.images,
              price: offer.price,
              compareAtPrice: offer.compareAtPrice,
              stock: offer.availableQuantity,
              brand: offer.brand,
              sku: offer.sku,
              unlimitedQuantity: isUnlimitedQuantity(offer.unlimitedQuantity),
            },
            offer,
            lineTotal: (offer.sellingPriceCents * item.quantity) / 100,
            lineTotalCents: offer.sellingPriceCents * item.quantity,
            inStock:
              isUnlimitedQuantity(offer.unlimitedQuantity) ||
              (offer.available && offer.availableQuantity >= item.quantity),
            parentProductId: item.parentProductId ? String(item.parentProductId) : undefined,
            locked: Boolean(item.parentProductId),
          });
        } catch {
          continue;
        }
      } else if (item.productId) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        items.push({
          productId: product.id,
          quantity: item.quantity,
          product,
          lineTotal: (product.price ?? 0) * item.quantity,
          lineTotalCents: Math.round((product.price ?? 0) * 100) * item.quantity,
          inStock:
            isUnlimitedQuantity(product.unlimitedQuantity) ||
            ((product.stock ?? 0) >= item.quantity && product.isActive !== false),
          parentProductId: item.parentProductId ? String(item.parentProductId) : undefined,
          locked: Boolean(item.parentProductId),
        });
      }
    }

    const subtotalCents = items.reduce((sum, item) => sum + (item.lineTotalCents || 0), 0);
    return {
      id: cart.id,
      items,
      subtotal: subtotalCents / 100,
      subtotalCents,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      currency: "CAD",
    };
  },

  async addItem(userId: string, input: { skuId?: string; productId?: string; quantity: number }) {
    let skuId = input.skuId;
    let productId = input.productId;
    if (!skuId && productId) {
      const resolved = await skuOfferService.resolveSkuForProductId(productId);
      if (resolved) skuId = String(resolved._id);
    }
    if (skuId) {
      const sku = await Sku.findById(skuId);
      if (!sku || sku.status !== "active") throw new NotFoundError("SKU not available");
      productId = String(sku.productId);
      const product = await Product.findById(productId).select("unlimitedQuantity sellIndependently isActive name");
      if (!product || product.isActive === false) throw new NotFoundError("Product not available");
      if (product.sellIndependently === false) {
        throw new BadRequestError("This item is included with another product and can't be added on its own");
      }
      const cart = await this.getOrCreate(userId);
      const existing = cart.items.find((item) => !item.parentProductId && String(item.skuId) === skuId);
      const nextQty = (existing?.quantity ?? 0) + input.quantity;
      assertOrderQuantityAllowed(nextQty, product.unlimitedQuantity);
      if (!isUnlimitedQuantity(product.unlimitedQuantity)) {
        const available = await inventoryReservationService.availableQuantity(skuId);
        if (nextQty > available) {
          throw new BadRequestError("Requested quantity exceeds available stock");
        }
      }
      if (existing) {
        existing.quantity = nextQty;
        existing.productId = sku.productId;
      } else {
        cart.items.push({ skuId: sku._id, productId: sku.productId, quantity: input.quantity });
      }
      await syncChildLines(cart, productId, nextQty);
      await cart.save();
      return this.getHydrated(userId);
    }

    if (!productId) throw new BadRequestError("skuId or productId is required");
    const product = await Product.findById(productId);
    if (!product || product.isActive === false) {
      throw new NotFoundError("Product not available");
    }
    if (product.sellIndependently === false) {
      throw new BadRequestError("This item is included with another product and can't be added on its own");
    }
    const cart = await this.getOrCreate(userId);
    const existing = cart.items.find(
      (item) => !item.parentProductId && String(item.productId) === productId && !item.skuId,
    );
    const nextQty = (existing?.quantity ?? 0) + input.quantity;
    assertOrderQuantityAllowed(nextQty, product.unlimitedQuantity);
    if (!isUnlimitedQuantity(product.unlimitedQuantity) && nextQty > (product.stock ?? 0)) {
      throw new BadRequestError("Requested quantity exceeds available stock");
    }
    if (existing) existing.quantity = nextQty;
    else cart.items.push({ productId: product._id, quantity: input.quantity });
    await syncChildLines(cart, productId, nextQty);
    await cart.save();
    return this.getHydrated(userId);
  },

  async updateItem(userId: string, key: string, quantity: number) {
    const cart = await this.getOrCreate(userId);
    const standalone = (item: CartItem) =>
      !item.parentProductId && (String(item.skuId) === key || String(item.productId) === key);
    const childHit = cart.items.find(
      (item) => item.parentProductId && (String(item.skuId) === key || String(item.productId) === key),
    );
    const existing = cart.items.find(standalone);
    if (!existing && childHit) {
      throw new BadRequestError("This item is included with another product. Change the main product to update it.");
    }
    if (quantity === 0) {
      const parentId = existing?.productId ? String(existing.productId) : "";
      cart.items = cart.items.filter((item) => {
        if (existing && item === existing) return false;
        if (parentId && String(item.parentProductId || "") === parentId) return false;
        if (!existing && (String(item.skuId) === key || String(item.productId) === key)) return false;
        return true;
      });
      await cart.save();
      return this.getHydrated(userId);
    }
    if (existing?.skuId) {
      const product = await Product.findById(existing.productId || key).select("unlimitedQuantity");
      assertOrderQuantityAllowed(quantity, product?.unlimitedQuantity);
      if (!isUnlimitedQuantity(product?.unlimitedQuantity)) {
        const available = await inventoryReservationService.availableQuantity(String(existing.skuId));
        if (quantity > available) throw new BadRequestError("Requested quantity exceeds available stock");
      }
      existing.quantity = quantity;
    } else {
      const product = await Product.findById(existing?.productId || key);
      if (!product || product.isActive === false) throw new NotFoundError("Product not available");
      if (!existing && product.sellIndependently === false) {
        throw new BadRequestError("This item is included with another product and can't be added on its own");
      }
      assertOrderQuantityAllowed(quantity, product.unlimitedQuantity);
      if (!isUnlimitedQuantity(product.unlimitedQuantity) && quantity > (product.stock ?? 0)) {
        throw new BadRequestError("Requested quantity exceeds available stock");
      }
      if (!existing) cart.items.push({ productId: product._id, quantity });
      else existing.quantity = quantity;
    }
    const parentId = String((existing || cart.items[cart.items.length - 1])?.productId || "");
    if (parentId) await syncChildLines(cart, parentId, quantity);
    await cart.save();
    return this.getHydrated(userId);
  },

  async removeItem(userId: string, key: string) {
    return this.updateItem(userId, key, 0);
  },

  async clear(userId: string) {
    const cart = await this.getOrCreate(userId);
    cart.items = [];
    await cart.save();
    return this.getHydrated(userId);
  },

  async restoreIfEmpty(
    userId: string,
    items: Array<{ skuId?: unknown; productId?: unknown; parentProductId?: unknown; quantity: number }>,
  ) {
    const cart = await this.getOrCreate(userId);
    if (cart.items.length > 0 || items.length === 0) {
      return this.getHydrated(userId);
    }
    cart.items = items.map((item) => ({
      skuId: item.skuId as CartItem["skuId"],
      productId: item.productId as CartItem["productId"],
      parentProductId: item.parentProductId as CartItem["parentProductId"],
      quantity: item.quantity,
    }));
    await cart.save();
    return this.getHydrated(userId);
  },
};
