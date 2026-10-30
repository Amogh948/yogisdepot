import { addCalendarDays, zonedParts } from "../../utils/sameDayDelivery";

export const SALES_TIME_ZONE = "America/Edmonton";

const PROVINCE_NAMES: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

export function provinceLabel(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "Unknown";
  const code = raw.toUpperCase();
  return PROVINCE_NAMES[code] || raw;
}

/** Percent change versus the previous period. Null when there is no prior baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  if (!Number.isFinite(current)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function calendarKey(parts: { year: number; month: number; day: number }): string {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function fillDailySales(
  rows: Array<{ date: string; revenueCents: number; orders: number }>,
  days: number,
  now: Date,
  timeZone = SALES_TIME_ZONE,
): Array<{ date: string; revenueCents: number; orders: number }> {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const today = zonedParts(now, timeZone);
  const points: Array<{ date: string; revenueCents: number; orders: number }> = [];
  const span = Math.max(1, days);
  for (let offset = span - 1; offset >= 0; offset -= 1) {
    const key = calendarKey(addCalendarDays(today, -offset));
    const row = byDate.get(key);
    points.push({
      date: key,
      revenueCents: row?.revenueCents || 0,
      orders: row?.orders || 0,
    });
  }
  return points;
}

export type ProductSalesLine = {
  productId: string;
  name: string;
  units: number;
  revenueCents: number;
  orderIds: string[];
};

export type BrandSalesRow = {
  name: string;
  units: number;
  revenueCents: number;
  orders: number;
};

export function rollupBrandSales(
  lines: ProductSalesLine[],
  products: Array<{ id: string; brandId?: string | null; brand?: string | null }>,
  brands: Array<{ id: string; name: string }>,
): BrandSalesRow[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const brandById = new Map(brands.map((brand) => [brand.id, brand.name]));
  const groups = new Map<string, { name: string; units: number; revenueCents: number; orders: Set<string> }>();

  for (const line of lines) {
    const product = productById.get(line.productId);
    const linkedName = product?.brandId ? brandById.get(String(product.brandId)) : "";
    const legacy = String(product?.brand || "").trim();
    const name = (linkedName || legacy || "Unbranded").trim() || "Unbranded";
    const group = groups.get(name) || { name, units: 0, revenueCents: 0, orders: new Set<string>() };
    group.units += line.units;
    group.revenueCents += line.revenueCents;
    for (const orderId of line.orderIds) group.orders.add(String(orderId));
    groups.set(name, group);
  }

  return [...groups.values()]
    .map((group) => ({
      name: group.name,
      units: group.units,
      revenueCents: group.revenueCents,
      orders: group.orders.size,
    }))
    .sort((a, b) => b.units - a.units || b.revenueCents - a.revenueCents);
}
