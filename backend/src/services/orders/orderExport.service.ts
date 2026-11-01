import ExcelJS from "exceljs";
import { BadRequestError } from "../../errors/AppError";
import { Order } from "../../models/Order";
import { Pricing } from "../../models/Pricing";
import { Product } from "../../models/Product";
import { Vendor } from "../../models/Vendor";
import { addCalendarDays, zonedParts, zonedWallTimeToUtc } from "../../utils/sameDayDelivery";

const TIME_ZONE = "America/Edmonton";

export function todayInEdmonton(now = new Date()): string {
  const parts = zonedParts(now, TIME_ZONE);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

/** Inclusive start and exclusive end of a calendar day in Calgary time. */
export function edmontonDayBounds(date: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestError("Use a date like 2026-05-01");
  }
  const [year, month, day] = date.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new BadRequestError("That date is not valid");
  }
  const start = zonedWallTimeToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, TIME_ZONE);
  const next = addCalendarDays({ year, month, day }, 1);
  const end = zonedWallTimeToUtc(
    { year: next.year, month: next.month, day: next.day, hour: 0, minute: 0, second: 0 },
    TIME_ZONE,
  );
  return { start, end };
}

function money(cents: number | null | undefined): number | "" {
  if (cents == null || !Number.isFinite(cents)) return "";
  return Math.round(cents) / 100;
}

function placedAt(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export const orderExportService = {
  async buildDailyWorkbook(dateInput?: string): Promise<{ date: string; buffer: Buffer }> {
    const date = dateInput?.trim() || todayInEdmonton();
    const { start, end } = edmontonDayBounds(date);
    const orders = await Order.find({ createdAt: { $gte: start, $lt: end } })
      .sort({ createdAt: 1 })
      .populate("customerId", "firstName lastName email");

    const skuIds = new Set<string>();
    const productIds = new Set<string>();
    const vendorIds = new Set<string>();
    for (const order of orders) {
      for (const item of order.items) {
        if (item.skuId) skuIds.add(String(item.skuId));
        if (item.productId) productIds.add(String(item.productId));
        if (item.parentProductId) productIds.add(String(item.parentProductId));
        if (item.vendorId) vendorIds.add(String(item.vendorId));
      }
    }

    const [pricings, products, vendors] = await Promise.all([
      skuIds.size
        ? Pricing.find({ skuId: { $in: [...skuIds] }, isActive: true }).sort({ effectiveFrom: -1 })
        : [],
      productIds.size ? Product.find({ _id: { $in: [...productIds] } }).select("name costPrice") : [],
      vendorIds.size ? Vendor.find({ _id: { $in: [...vendorIds] } }).select("businessName") : [],
    ]);

    const costBySku = new Map<string, number>();
    for (const row of pricings) {
      const id = String(row.skuId);
      if (!costBySku.has(id)) costBySku.set(id, row.costPriceCents);
    }
    const productById = new Map(products.map((product) => [String(product._id), product]));
    const vendorById = new Map(vendors.map((vendor) => [String(vendor._id), vendor.businessName]));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Yogi's Depot";
    const sheet = workbook.addWorksheet("Orders");
    sheet.columns = [
      { header: "Order number", key: "orderNumber", width: 18 },
      { header: "Order ID", key: "orderId", width: 26 },
      { header: "Placed at (Calgary)", key: "placedAt", width: 22 },
      { header: "Customer", key: "customer", width: 24 },
      { header: "Email", key: "email", width: 28 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "City", key: "city", width: 16 },
      { header: "Province", key: "province", width: 12 },
      { header: "Postal code", key: "postalCode", width: 14 },
      { header: "Address", key: "address", width: 36 },
      { header: "Payment status", key: "paymentStatus", width: 16 },
      { header: "Order status", key: "orderStatus", width: 18 },
      { header: "Product", key: "product", width: 32 },
      { header: "Variant", key: "variant", width: 18 },
      { header: "SKU", key: "sku", width: 18 },
      { header: "Included with", key: "includedWith", width: 28 },
      { header: "Quantity", key: "quantity", width: 12 },
      { header: "Unit cost", key: "unitCost", width: 14 },
      { header: "Line cost", key: "lineCost", width: 14 },
      { header: "Unit selling price", key: "unitPrice", width: 18 },
      { header: "Line selling total", key: "lineTotal", width: 18 },
      { header: "Vendor", key: "vendor", width: 24 },
    ];
    sheet.getRow(1).font = { bold: true };

    const moneyKeys = ["unitCost", "lineCost", "unitPrice", "lineTotal"] as const;

    for (const order of orders) {
      const customer = order.customerId as unknown as { firstName?: string; lastName?: string; email?: string } | null;
      const customerName = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim();
      const address = order.shippingAddress;
      for (const item of order.items) {
        const product = productById.get(String(item.productId));
        const parent = item.parentProductId ? productById.get(String(item.parentProductId)) : undefined;
        const skuCost = item.skuId ? costBySku.get(String(item.skuId)) : undefined;
        const productCostCents =
          product?.costPrice != null && Number.isFinite(product.costPrice) ? Math.round(product.costPrice * 100) : undefined;
        const unitCostCents = skuCost ?? productCostCents;
        const row = sheet.addRow({
          orderNumber: order.orderNumber,
          orderId: String(order._id),
          placedAt: placedAt(order.createdAt),
          customer: customerName || address?.fullName || "",
          email: customer?.email || "",
          phone: address?.phone || "",
          city: address?.city || "",
          province: address?.state || "",
          postalCode: address?.postalCode || "",
          address: [address?.addressLine1, address?.addressLine2].filter(Boolean).join(", "),
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          product: item.productName,
          variant: item.variantName || "",
          sku: item.skuCode || "",
          includedWith: parent?.name || "",
          quantity: item.quantity,
          unitCost: money(unitCostCents),
          lineCost: unitCostCents == null ? "" : money(unitCostCents * item.quantity),
          unitPrice: money(item.unitPriceCents),
          lineTotal: money(item.totalAmountCents),
          vendor: vendorById.get(String(item.vendorId)) || "",
        });
        for (const key of moneyKeys) {
          const cell = row.getCell(key);
          if (typeof cell.value === "number") cell.numFmt = '"$"#,##0.00';
        }
      }
    }

    if (orders.length === 0) {
      sheet.addRow({ orderNumber: "No orders on this date" });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { date, buffer };
  },
};
