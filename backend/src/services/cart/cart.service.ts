import { BadRequestError, NotFoundError } from "../../errors/AppError";
import { Cart, type CartItem } from "../../models/Cart";
import { Product } from "../../models/Product";
import { Sku } from "../../models/Sku";
import { inventoryReservationService } from "../inventory/inventoryReservation.service";
import { skuOfferService } from "../catalog/skuOffer.service";

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
            },
            offer,
            lineTotal: (offer.sellingPriceCents * item.quantity) / 100,
            lineTotalCents: offer.sellingPriceCents * item.quantity,
            inStock: offer.available && offer.availableQuantity >= item.quantity,
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
          inStock: (product.stock ?? 0) >= item.quantity && product.isActive !== false,
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
      const available = await inventoryReservationService.availableQuantity(skuId);
      const cart = await this.getOrCreate(userId);
      const existing = cart.items.find((item) => String(item.skuId) === skuId);
      const nextQty = (existing?.quantity ?? 0) + input.quantity;
      if (nextQty > available) {
        throw new BadRequestError("Requested quantity exceeds available stock");
      }
      if (existing) {
        existing.quantity = nextQty;
        existing.productId = sku.productId;
      } else {
        cart.items.push({ skuId: sku._id, productId: sku.productId, quantity: input.quantity });
      }
      await cart.save();
      return this.getHydrated(userId);
    }

    if (!productId) throw new BadRequestError("skuId or productId is required");
    const product = await Product.findById(productId);
    if (!product || product.isActive === false) {
      throw new NotFoundError("Product not available");
    }
    const cart = await this.getOrCreate(userId);
    const existing = cart.items.find((item) => String(item.productId) === productId && !item.skuId);
    const nextQty = (existing?.quantity ?? 0) + input.quantity;
    if (nextQty > (product.stock ?? 0)) {
      throw new BadRequestError("Requested quantity exceeds available stock");
    }
    if (existing) existing.quantity = nextQty;
    else cart.items.push({ productId: product._id, quantity: input.quantity });
    await cart.save();
    return this.getHydrated(userId);
  },

  async updateItem(userId: string, key: string, quantity: number) {
    const cart = await this.getOrCreate(userId);
    const match = (item: CartItem) => String(item.skuId) === key || String(item.productId) === key;
    if (quantity === 0) {
      cart.items = cart.items.filter((item) => !match(item));
      await cart.save();
      return this.getHydrated(userId);
    }
    const existing = cart.items.find(match);
    if (existing?.skuId) {
      const available = await inventoryReservationService.availableQuantity(String(existing.skuId));
      if (quantity > available) throw new BadRequestError("Requested quantity exceeds available stock");
      existing.quantity = quantity;
    } else {
      const product = await Product.findById(key);
      if (!product || product.isActive === false) throw new NotFoundError("Product not available");
      if (quantity > (product.stock ?? 0)) {
        throw new BadRequestError("Requested quantity exceeds available stock");
      }
      if (!existing) cart.items.push({ productId: product._id, quantity });
      else existing.quantity = quantity;
    }
    await cart.save();
    return this.getHydrated(userId);
  },

  async removeItem(userId: string, key: string) {
    const cart = await this.getOrCreate(userId);
    cart.items = cart.items.filter(
      (item) => String(item.skuId) !== key && String(item.productId) !== key,
    );
    await cart.save();
    return this.getHydrated(userId);
  },

  async clear(userId: string) {
    const cart = await this.getOrCreate(userId);
    cart.items = [];
    await cart.save();
    return this.getHydrated(userId);
  },

  async restoreIfEmpty(
    userId: string,
    items: Array<{ skuId?: unknown; productId?: unknown; quantity: number }>,
  ) {
    const cart = await this.getOrCreate(userId);
    if (cart.items.length > 0 || items.length === 0) {
      return this.getHydrated(userId);
    }
    cart.items = items.map((item) => ({
      skuId: item.skuId as CartItem["skuId"],
      productId: item.productId as CartItem["productId"],
      quantity: item.quantity,
    }));
    await cart.save();
    return this.getHydrated(userId);
  },
};
