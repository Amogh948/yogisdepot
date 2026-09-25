import { BadRequestError, NotFoundError } from "../../errors/AppError";
import { Cart, type CartItem } from "../../models/Cart";
import { Product } from "../../models/Product";

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
    const productIds = cart.items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const items = cart.items
      .map((item) => {
        const product = productMap.get(String(item.productId));
        if (!product) {
          return null;
        }
        return {
          productId: product.id,
          quantity: item.quantity,
          product,
          lineTotal: product.price * item.quantity,
          inStock: product.stock >= item.quantity && product.isActive,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    return { id: cart.id, items, subtotal, itemCount: items.reduce((s, i) => s + i.quantity, 0) };
  },

  async addItem(userId: string, productId: string, quantity: number) {
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new NotFoundError("Product not available");
    }
    const cart = await this.getOrCreate(userId);
    const existing = cart.items.find((item) => String(item.productId) === productId);
    const nextQty = (existing?.quantity ?? 0) + quantity;
    if (nextQty > product.stock) {
      throw new BadRequestError("Requested quantity exceeds available stock");
    }
    if (existing) {
      existing.quantity = nextQty;
    } else {
      cart.items.push({ productId: product._id, quantity });
    }
    await cart.save();
    return this.getHydrated(userId);
  },

  async updateItem(userId: string, productId: string, quantity: number) {
    const cart = await this.getOrCreate(userId);
    if (quantity === 0) {
      cart.items = cart.items.filter((item) => String(item.productId) !== productId);
      await cart.save();
      return this.getHydrated(userId);
    }
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new NotFoundError("Product not available");
    }
    if (quantity > product.stock) {
      throw new BadRequestError("Requested quantity exceeds available stock");
    }
    const existing = cart.items.find((item) => String(item.productId) === productId);
    if (!existing) {
      cart.items.push({ productId: product._id, quantity });
    } else {
      existing.quantity = quantity;
    }
    await cart.save();
    return this.getHydrated(userId);
  },

  async removeItem(userId: string, productId: string) {
    const cart = await this.getOrCreate(userId);
    cart.items = cart.items.filter((item) => String(item.productId) !== productId);
    await cart.save();
    return this.getHydrated(userId);
  },

  async clear(userId: string) {
    const cart = await this.getOrCreate(userId);
    cart.items = [];
    await cart.save();
    return this.getHydrated(userId);
  },

  async restoreIfEmpty(userId: string, items: Array<{ productId: unknown; quantity: number }>) {
    const cart = await this.getOrCreate(userId);
    if (cart.items.length > 0 || items.length === 0) {
      return this.getHydrated(userId);
    }
    cart.items = items.map((item) => ({
      productId: item.productId as CartItem["productId"],
      quantity: item.quantity,
    }));
    await cart.save();
    return this.getHydrated(userId);
  },
};
