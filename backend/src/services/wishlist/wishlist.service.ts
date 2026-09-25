import { ConflictError, NotFoundError } from "../../errors/AppError";
import { Product } from "../../models/Product";
import { Wishlist } from "../../models/Wishlist";

export const wishlistService = {
  async list(userId: string) {
    const entries = await Wishlist.find({ userId }).sort({ createdAt: -1 }).populate("productId");
    return entries.map((entry) => entry.productId).filter(Boolean);
  },

  async add(userId: string, productId: string) {
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new NotFoundError("Product not found");
    }
    try {
      await Wishlist.create({ userId, productId });
    } catch (error) {
      const mongoErr = error as { code?: number };
      if (mongoErr.code === 11000) {
        throw new ConflictError("Product is already in your wishlist");
      }
      throw error;
    }
    return this.list(userId);
  },

  async remove(userId: string, productId: string) {
    await Wishlist.findOneAndDelete({ userId, productId });
    return this.list(userId);
  },
};
