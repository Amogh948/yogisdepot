import { Types } from "mongoose";
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/AppError";
import { Order } from "../../models/Order";
import { Product } from "../../models/Product";
import { Review } from "../../models/Review";
import { buildPagination, parsePagination } from "../../utils/pagination";

async function recalculateProductRating(productId: string): Promise<void> {
  const stats = await Review.aggregate([
    { $match: { productId: new Types.ObjectId(productId), isApproved: true } },
    { $group: { _id: "$productId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const avg = stats[0]?.avg ?? 0;
  const count = stats[0]?.count ?? 0;
  await Product.findByIdAndUpdate(productId, {
    rating: Math.round(avg * 10) / 10,
    reviewCount: count,
  });
}

export const reviewService = {
  async create(customerId: string, input: {
    productId: string;
    orderId: string;
    rating: number;
    title?: string;
    comment: string;
    images?: string[];
  }) {
    const order = await Order.findOne({ _id: input.orderId, customerId });
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    if (order.orderStatus !== "delivered") {
      throw new ForbiddenError("You can review products after they are delivered");
    }
    const purchased = order.items.some((item) => String(item.productId) === input.productId);
    if (!purchased) {
      throw new ForbiddenError("You can only review products you purchased");
    }
    const existing = await Review.findOne({ productId: input.productId, customerId });
    if (existing) {
      throw new ConflictError("You have already reviewed this product");
    }
    const review = await Review.create({
      ...input,
      customerId,
      isVerifiedPurchase: true,
      isApproved: true,
    });
    await recalculateProductRating(input.productId);
    return review;
  },

  async listForProduct(productId: string, query: { page?: number; limit?: number }) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { productId, isApproved: true };
    const [data, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("customerId", "firstName lastName avatar"),
      Review.countDocuments(filter),
    ]);
    return { data, pagination: buildPagination(page, limit, total) };
  },

  async listMine(customerId: string) {
    return Review.find({ customerId }).sort({ createdAt: -1 }).populate("productId", "name slug thumbnail");
  },

  async listAll(query: { page?: number; limit?: number }) {
    const { page, limit, skip } = parsePagination(query);
    const [data, total] = await Promise.all([
      Review.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate("customerId", "firstName lastName email").populate("productId", "name slug"),
      Review.countDocuments(),
    ]);
    return { data, pagination: buildPagination(page, limit, total) };
  },

  async moderate(id: string, isApproved: boolean) {
    const review = await Review.findByIdAndUpdate(id, { isApproved }, { new: true });
    if (!review) {
      throw new NotFoundError("Review not found");
    }
    await recalculateProductRating(String(review.productId));
    return review;
  },
};
