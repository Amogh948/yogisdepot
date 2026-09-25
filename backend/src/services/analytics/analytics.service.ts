import { Order } from "../../models/Order";
import { Product } from "../../models/Product";
import { User } from "../../models/User";
import { Vendor } from "../../models/Vendor";
import { Types } from "mongoose";

function startOfDaysAgo(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

export const analyticsService = {
  async adminOverview() {
    const paidMatch = { orderStatus: { $nin: ["cancelled"] } };
    const [sales] = await Order.aggregate([
      { $match: paidMatch },
      { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
    ]);
    const [customers, vendors, activeProducts, lowStock, pendingVendors, pendingOrders] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      Vendor.countDocuments({ status: { $in: ["approved", "active"] } }),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true, $expr: { $lte: ["$stock", "$lowStockThreshold"] } }),
      Vendor.countDocuments({ approvalStatus: "pending" }),
      Order.countDocuments({ orderStatus: { $in: ["pending", "confirmed"] } }),
    ]);

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(8).populate("customerId", "firstName lastName");
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", name: { $first: "$items.productName" }, units: { $sum: "$items.quantity" }, revenue: { $sum: "$items.totalPrice" } } },
      { $sort: { units: -1 } },
      { $limit: 8 },
    ]);
    const topVendors = await Order.aggregate([
      { $unwind: "$items" },
      { $group: { _id: "$items.vendorId", units: { $sum: "$items.quantity" }, revenue: { $sum: "$items.totalPrice" } } },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]);
    const statusDistribution = await Order.aggregate([
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
    ]);
    const salesChart = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfDaysAgo(13) }, orderStatus: { $nin: ["cancelled"] } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      revenue: sales?.revenue ?? 0,
      totalOrders: sales?.orders ?? 0,
      totalCustomers: customers,
      totalVendors: vendors,
      activeProducts,
      lowStockProducts: lowStock,
      pendingVendorApprovals: pendingVendors,
      pendingOrders,
      recentOrders,
      topProducts,
      topVendors,
      statusDistribution,
      salesChart,
    };
  },

  async vendorOverview(vendorId: string) {
    const vendorObjectId = new Types.ObjectId(vendorId);
    const match = { "items.vendorId": vendorObjectId, orderStatus: { $nin: ["cancelled"] } };
    const [sales] = await Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      { $match: { "items.vendorId": vendorObjectId } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$items.totalPrice" },
          units: { $sum: "$items.quantity" },
          orders: { $addToSet: "$_id" },
        },
      },
      { $project: { revenue: 1, units: 1, orders: { $size: "$orders" } } },
    ]);
    const [products, activeProducts, lowStock] = await Promise.all([
      Product.countDocuments({ vendorId }),
      Product.countDocuments({ vendorId, isActive: true }),
      Product.countDocuments({ vendorId, isActive: true, $expr: { $lte: ["$stock", "$lowStockThreshold"] } }),
    ]);
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      { $match: { "items.vendorId": vendorObjectId } },
      { $group: { _id: "$items.productId", name: { $first: "$items.productName" }, units: { $sum: "$items.quantity" }, revenue: { $sum: "$items.totalPrice" } } },
      { $sort: { units: -1 } },
      { $limit: 8 },
    ]);
    const recentOrders = await Order.find({ "items.vendorId": vendorId }).sort({ createdAt: -1 }).limit(8);
    const salesChart = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfDaysAgo(13) } } },
      { $unwind: "$items" },
      { $match: { "items.vendorId": vendorObjectId } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$items.totalPrice" },
          units: { $sum: "$items.quantity" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return {
      revenue: sales?.revenue ?? 0,
      orders: sales?.orders ?? 0,
      unitsSold: sales?.units ?? 0,
      products,
      activeProducts,
      lowStockProducts: lowStock,
      topProducts,
      recentOrders,
      salesChart,
    };
  },
};
