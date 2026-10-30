import { Types } from "mongoose";
import { Brand } from "../../models/Brand";
import { Order } from "../../models/Order";
import { Product } from "../../models/Product";
import { User } from "../../models/User";
import { Vendor } from "../../models/Vendor";
import { addCalendarDays, zonedParts, zonedWallTimeToUtc } from "../../utils/sameDayDelivery";
import {
  SALES_TIME_ZONE,
  fillDailySales,
  provinceLabel,
  percentChange,
  rollupBrandSales,
  type ProductSalesLine,
} from "./analytics.insights";

function startOfDaysAgo(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function edmontonDayStart(daysAgo: number, now = new Date()): Date {
  const today = zonedParts(now, SALES_TIME_ZONE);
  const day = addCalendarDays(today, -daysAgo);
  return zonedWallTimeToUtc(
    { year: day.year, month: day.month, day: day.day, hour: 0, minute: 0, second: 0 },
    SALES_TIME_ZONE,
  );
}

/** Paid orders only. Cancelled and refunded checkouts are not sales. */
const paidSalesMatch = {
  paymentStatus: "paid",
  orderStatus: { $nin: ["cancelled", "refunded"] },
};

const orderRevenueCents = {
  $cond: [
    { $gt: [{ $ifNull: ["$totalCents", 0] }, 0] },
    "$totalCents",
    { $round: [{ $multiply: [{ $ifNull: ["$total", 0] }, 100] }, 0] },
  ],
};

const lineRevenueCents = {
  $cond: [
    { $gt: [{ $ifNull: ["$items.totalAmountCents", 0] }, 0] },
    "$items.totalAmountCents",
    { $round: [{ $multiply: [{ $ifNull: ["$items.totalPrice", 0] }, 100] }, 0] },
  ],
};

function periodGroup() {
  return [{ $group: { _id: null, revenueCents: { $sum: orderRevenueCents }, orders: { $sum: 1 } } }];
}

function customerName(value: unknown): string {
  if (value && typeof value === "object" && "firstName" in value) {
    const person = value as { firstName?: string; lastName?: string };
    return [person.firstName, person.lastName].filter(Boolean).join(" ") || "Customer";
  }
  return "Customer";
}

export const analyticsService = {
  async adminOverview() {
    const now = new Date();
    const todayStart = edmontonDayStart(0, now);
    const last7Start = edmontonDayStart(6, now);
    const previous7Start = edmontonDayStart(13, now);
    const last30Start = edmontonDayStart(29, now);

    const [facetRow] = await Order.aggregate([
      { $match: paidSalesMatch },
      {
        $facet: {
          totals: periodGroup(),
          today: [{ $match: { createdAt: { $gte: todayStart } } }, ...periodGroup()],
          last7: [{ $match: { createdAt: { $gte: last7Start } } }, ...periodGroup()],
          previous7: [
            { $match: { createdAt: { $gte: previous7Start, $lt: last7Start } } },
            ...periodGroup(),
          ],
          last30: [{ $match: { createdAt: { $gte: last30Start } } }, ...periodGroup()],
          regions: [
            {
              $group: {
                _id: {
                  $toUpper: { $trim: { input: { $ifNull: ["$shippingAddress.state", ""] } } },
                },
                orders: { $sum: 1 },
                revenueCents: { $sum: orderRevenueCents },
              },
            },
            { $sort: { orders: -1, revenueCents: -1 } },
            { $limit: 8 },
          ],
          cities: [
            {
              $group: {
                _id: {
                  city: { $toLower: { $trim: { input: { $ifNull: ["$shippingAddress.city", ""] } } } },
                  state: {
                    $toUpper: { $trim: { input: { $ifNull: ["$shippingAddress.state", ""] } } },
                  },
                },
                city: { $first: { $trim: { input: { $ifNull: ["$shippingAddress.city", ""] } } } },
                state: { $first: { $toUpper: { $trim: { input: { $ifNull: ["$shippingAddress.state", ""] } } } } },
                orders: { $sum: 1 },
                revenueCents: { $sum: orderRevenueCents },
              },
            },
            { $sort: { orders: -1, revenueCents: -1 } },
            { $limit: 8 },
          ],
          chart: [
            { $match: { createdAt: { $gte: last30Start } } },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: SALES_TIME_ZONE },
                },
                revenueCents: { $sum: orderRevenueCents },
                orders: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    const productLines = await Order.aggregate<ProductSalesLine & { _id: Types.ObjectId }>([
      { $match: paidSalesMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.productName" },
          units: { $sum: "$items.quantity" },
          revenueCents: { $sum: lineRevenueCents },
          orderIds: { $addToSet: "$_id" },
        },
      },
    ]);

    const productIds = productLines.map((line) => line._id).filter(Boolean);
    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds } }).select("brandId brand")
      : [];
    const brandIds = products.map((product) => product.brandId).filter(Boolean);
    const brands = brandIds.length ? await Brand.find({ _id: { $in: brandIds } }).select("name") : [];
    const salesLines: ProductSalesLine[] = productLines.map((line) => ({
      productId: String(line._id),
      name: line.name || "Product",
      units: line.units || 0,
      revenueCents: line.revenueCents || 0,
      orderIds: (line.orderIds || []).map((id) => String(id)),
    }));
    const topBrands = rollupBrandSales(
      salesLines,
      products.map((product) => ({
        id: String(product._id),
        brandId: product.brandId ? String(product.brandId) : null,
        brand: product.brand,
      })),
      brands.map((brand) => ({ id: String(brand._id), name: brand.name })),
    ).slice(0, 8);
    const topProducts = [...salesLines]
      .sort((a, b) => b.units - a.units || b.revenueCents - a.revenueCents)
      .slice(0, 8)
      .map((line) => ({
        id: line.productId,
        name: line.name,
        units: line.units,
        revenueCents: line.revenueCents,
        orders: line.orderIds.length,
      }));

    const [customers, vendors, activeProducts, lowStock, pendingVendors, pendingOrders, recent] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      Vendor.countDocuments({ status: { $in: ["approved", "active"] } }),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true, $expr: { $lte: ["$stock", "$lowStockThreshold"] } }),
      Vendor.countDocuments({ approvalStatus: "pending" }),
      Order.countDocuments({ orderStatus: { $in: ["pending", "confirmed"] }, paymentStatus: { $ne: "failed" } }),
      Order.find(paidSalesMatch)
        .sort({ createdAt: -1 })
        .limit(6)
        .select("orderNumber totalCents total shippingAddress.city shippingAddress.state orderStatus createdAt customerId")
        .populate("customerId", "firstName lastName"),
    ]);

    const totals = facetRow?.totals?.[0];
    const today = facetRow?.today?.[0];
    const last7 = facetRow?.last7?.[0];
    const previous7 = facetRow?.previous7?.[0];
    const last30 = facetRow?.last30?.[0];
    const revenueCents = totals?.revenueCents || 0;
    const totalOrders = totals?.orders || 0;
    const regions = (facetRow?.regions || []).map((row: { _id?: string; orders: number; revenueCents: number }) => ({
      name: provinceLabel(row._id),
      orders: row.orders,
      revenueCents: row.revenueCents || 0,
    }));
    const cities = (facetRow?.cities || [])
      .filter((row: { city?: string }) => String(row.city || "").trim())
      .map((row: { city: string; state?: string; orders: number; revenueCents: number }) => ({
        name: row.state ? `${row.city}, ${row.state}` : row.city,
        orders: row.orders,
        revenueCents: row.revenueCents || 0,
      }));

    return {
      currency: "CAD",
      timeZone: SALES_TIME_ZONE,
      revenueCents,
      revenue: revenueCents / 100,
      totalOrders,
      averageOrderCents: totalOrders > 0 ? Math.round(revenueCents / totalOrders) : 0,
      weekOverWeekPercent: percentChange(last7?.revenueCents || 0, previous7?.revenueCents || 0),
      periods: {
        today: { revenueCents: today?.revenueCents || 0, orders: today?.orders || 0 },
        last7: { revenueCents: last7?.revenueCents || 0, orders: last7?.orders || 0 },
        previous7: { revenueCents: previous7?.revenueCents || 0, orders: previous7?.orders || 0 },
        last30: { revenueCents: last30?.revenueCents || 0, orders: last30?.orders || 0 },
      },
      topRegion: regions[0] || null,
      topProduct: topProducts[0] || null,
      topBrand: topBrands[0] || null,
      regions,
      cities,
      topProducts,
      topBrands,
      salesChart: fillDailySales(
        (facetRow?.chart || []).map((row: { _id: string; revenueCents: number; orders: number }) => ({
          date: row._id,
          revenueCents: row.revenueCents || 0,
          orders: row.orders || 0,
        })),
        30,
        now,
      ),
      recentOrders: recent.map((order) => ({
        id: String(order._id),
        orderNumber: order.orderNumber,
        customerName: customerName(order.customerId),
        city: order.shippingAddress?.city || "",
        state: order.shippingAddress?.state || "",
        orderStatus: order.orderStatus,
        totalCents: order.totalCents || Math.round((order.total || 0) * 100),
        createdAt: order.createdAt,
      })),
      totalCustomers: customers,
      totalVendors: vendors,
      activeProducts,
      lowStockProducts: lowStock,
      pendingVendorApprovals: pendingVendors,
      pendingOrders,
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
