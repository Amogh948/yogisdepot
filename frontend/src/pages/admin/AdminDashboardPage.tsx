import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Skeleton } from "../../components/ui/Feedback";
import { formatCadFromCents } from "../../utils/money";

type Metric = { revenueCents: number; orders: number };
type NamedMetric = { name: string; orders: number; revenueCents: number };
type ProductMetric = { id?: string; name: string; units: number; revenueCents: number; orders: number };
type BrandMetric = { name: string; units: number; revenueCents: number; orders: number };
type ChartPoint = { date: string; revenueCents: number; orders: number };
type RecentOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  city: string;
  state: string;
  orderStatus: string;
  totalCents: number;
  createdAt: string;
};

type DashboardData = {
  revenueCents: number;
  totalOrders: number;
  averageOrderCents: number;
  weekOverWeekPercent: number | null;
  periods: { today: Metric; last7: Metric; last30: Metric };
  topRegion: NamedMetric | null;
  topProduct: ProductMetric | null;
  topBrand: BrandMetric | null;
  regions: NamedMetric[];
  cities: NamedMetric[];
  topProducts: ProductMetric[];
  topBrands: BrandMetric[];
  salesChart: ChartPoint[];
  recentOrders: RecentOrder[];
  totalCustomers: number;
  activeProducts: number;
  lowStockProducts: number;
  pendingOrders: number;
};

function asDashboard(value: unknown): DashboardData {
  const data = (value || {}) as Partial<DashboardData>;
  return {
    revenueCents: Number(data.revenueCents || 0),
    totalOrders: Number(data.totalOrders || 0),
    averageOrderCents: Number(data.averageOrderCents || 0),
    weekOverWeekPercent: typeof data.weekOverWeekPercent === "number" ? data.weekOverWeekPercent : null,
    periods: {
      today: data.periods?.today || { revenueCents: 0, orders: 0 },
      last7: data.periods?.last7 || { revenueCents: 0, orders: 0 },
      last30: data.periods?.last30 || { revenueCents: 0, orders: 0 },
    },
    topRegion: data.topRegion || null,
    topProduct: data.topProduct || null,
    topBrand: data.topBrand || null,
    regions: data.regions || [],
    cities: data.cities || [],
    topProducts: data.topProducts || [],
    topBrands: data.topBrands || [],
    salesChart: data.salesChart || [],
    recentOrders: data.recentOrders || [],
    totalCustomers: Number(data.totalCustomers || 0),
    activeProducts: Number(data.activeProducts || 0),
    lowStockProducts: Number(data.lowStockProducts || 0),
    pendingOrders: Number(data.pendingOrders || 0),
  };
}

function shortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function Trend({ value }: { value: number | null }) {
  if (value == null) return <span className="text-sm text-white/70">No prior week to compare</span>;
  const up = value >= 0;
  return (
    <span className={`text-sm font-semibold ${up ? "text-yd-cream" : "text-red-200"}`}>
      {up ? "+" : ""}
      {value}% vs the previous week
    </span>
  );
}

function RankBars({
  rows,
  detail,
}: {
  rows: Array<{ name: string; value: number; detail: string }>;
  detail: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  if (!rows.length) {
    return <p className="text-sm text-yd-muted">{detail}</p>;
  }
  return (
    <ol className="space-y-3">
      {rows.map((row) => (
        <li key={row.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-yd-ink">{row.name}</span>
            <span className="shrink-0 text-yd-muted">{row.detail}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-yd-cream">
            <div className="h-full rounded-full bg-yd-green" style={{ width: `${Math.max(6, (row.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function SalesChart({ points }: { points: ChartPoint[] }) {
  const max = Math.max(...points.map((point) => point.revenueCents), 1);
  const labelIndexes = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);
  return (
    <div>
      <div className="flex h-44 items-end gap-1">
        {points.map((point) => (
          <div key={point.date} className="group flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-yd-green/80 transition group-hover:bg-yd-forest"
              style={{ height: `${point.revenueCents > 0 ? Math.max(6, (point.revenueCents / max) * 100) : 0}%` }}
              title={`${shortDate(point.date)}: ${formatCadFromCents(point.revenueCents)} · ${point.orders} orders`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-yd-muted">
        {points.map((point, index) => (
          <span key={point.date} className={`flex-1 text-center ${labelIndexes.has(index) ? "" : "invisible"}`}>
            {shortDate(point.date)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const query = useQuery({ queryKey: ["admin-analytics"], queryFn: () => adminApi.analytics() });
  if (query.isLoading) return <Skeleton className="h-64" />;
  if (query.isError) {
    return (
      <div>
        <PageHeader title="Sales" />
        <p className="text-sm text-yd-error">Sales could not be loaded. Refresh the page to try again.</p>
      </div>
    );
  }

  const data = asDashboard(query.data?.data);
  const hasSales = data.totalOrders > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" />
      <p className="-mt-3 text-sm text-yd-muted">
        Paid orders only, dated in Calgary time. Cancelled and refunded payments are left out.
      </p>

      <section className="grid gap-3 lg:grid-cols-4">
        <article className="rounded-2xl bg-yd-forest p-5 text-white lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">All sales</p>
          <p className="mt-2 font-display text-4xl">{formatCadFromCents(data.revenueCents)}</p>
          <p className="mt-2">
            <Trend value={data.weekOverWeekPercent} />
          </p>
          <p className="mt-3 text-sm text-white/80">
            {data.periods.last7.orders} orders this week · {formatCadFromCents(data.periods.last7.revenueCents)}
          </p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-yd-muted">Today</p>
          <p className="mt-2 font-display text-3xl text-yd-forest">{formatCadFromCents(data.periods.today.revenueCents)}</p>
          <p className="mt-2 text-sm text-yd-muted">{data.periods.today.orders} orders</p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-yd-muted">Average order</p>
          <p className="mt-2 font-display text-3xl text-yd-forest">{formatCadFromCents(data.averageOrderCents)}</p>
          <p className="mt-2 text-sm text-yd-muted">{data.totalOrders} paid orders</p>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-yd-border bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-yd-muted">Ordering more from</p>
          <p className="mt-2 font-display text-3xl text-yd-forest">{data.topRegion?.name || "—"}</p>
          <p className="mt-2 text-sm text-yd-muted">
            {data.topRegion
              ? `${data.topRegion.orders} orders · ${formatCadFromCents(data.topRegion.revenueCents)}`
              : "Regions show up after the first paid order."}
          </p>
        </article>
        <article className="rounded-2xl border border-yd-border bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-yd-muted">Most ordered product</p>
          <p className="mt-2 font-display text-2xl leading-tight text-yd-forest">{data.topProduct?.name || "—"}</p>
          <p className="mt-2 text-sm text-yd-muted">
            {data.topProduct
              ? `${data.topProduct.units} units · ${formatCadFromCents(data.topProduct.revenueCents)}`
              : "Product ranking uses paid order lines."}
          </p>
        </article>
        <article className="rounded-2xl border border-yd-border bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-yd-muted">Brand people choose</p>
          <p className="mt-2 font-display text-3xl text-yd-forest">{data.topBrand?.name || "—"}</p>
          <p className="mt-2 text-sm text-yd-muted">
            {data.topBrand
              ? `${data.topBrand.units} units across ${data.topBrand.orders} orders`
              : "Brand ranking follows the products in paid orders."}
          </p>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="font-display text-lg text-yd-forest">Provinces</h2>
          <div className="mt-4">
            <RankBars
              rows={data.regions.map((row) => ({
                name: row.name,
                value: row.orders,
                detail: `${row.orders} · ${formatCadFromCents(row.revenueCents)}`,
              }))}
              detail={hasSales ? "No province was saved on these orders." : "No paid orders yet."}
            />
          </div>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="font-display text-lg text-yd-forest">Cities</h2>
          <div className="mt-4">
            <RankBars
              rows={data.cities.map((row) => ({
                name: row.name,
                value: row.orders,
                detail: `${row.orders} · ${formatCadFromCents(row.revenueCents)}`,
              }))}
              detail={hasSales ? "No city was saved on these orders." : "No paid orders yet."}
            />
          </div>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="font-display text-lg text-yd-forest">Last 30 days</h2>
          <p className="mt-1 text-sm text-yd-muted">{formatCadFromCents(data.periods.last30.revenueCents)} · {data.periods.last30.orders} orders</p>
          <div className="mt-4">
            <SalesChart points={data.salesChart} />
          </div>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="font-display text-lg text-yd-forest">Top products</h2>
          <div className="mt-4">
            <RankBars
              rows={data.topProducts.map((row) => ({
                name: row.name,
                value: row.units,
                detail: `${row.units} units · ${formatCadFromCents(row.revenueCents)}`,
              }))}
              detail="No product sales yet."
            />
          </div>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="font-display text-lg text-yd-forest">Top brands</h2>
          <div className="mt-4">
            <RankBars
              rows={data.topBrands.map((row) => ({
                name: row.name,
                value: row.units,
                detail: `${row.units} units · ${formatCadFromCents(row.revenueCents)}`,
              }))}
              detail="No brand sales yet."
            />
          </div>
        </article>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-yd-forest">Recent paid orders</h2>
          <Link to="/admin/orders" className="text-sm font-semibold text-yd-green">
            All orders
          </Link>
        </div>
        {data.recentOrders.length ? (
          <ul className="mt-4 divide-y divide-yd-border">
            {data.recentOrders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <Link to={`/admin/orders/${order.id}`} className="font-semibold text-yd-ink">
                    {order.orderNumber}
                  </Link>
                  <p className="text-yd-muted">
                    {order.customerName}
                    {order.city ? ` · ${order.city}${order.state ? `, ${order.state}` : ""}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCadFromCents(order.totalCents)}</p>
                  <p className="capitalize text-yd-muted">{order.orderStatus.replace(/_/g, " ")}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-yd-muted">Paid orders will show up here.</p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Customers", data.totalCustomers],
          ["Active products", data.activeProducts],
          ["Low stock", data.lowStockProducts],
          ["Orders in progress", data.pendingOrders],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl bg-white p-4 shadow-soft">
            <p className="text-sm text-yd-muted">{label}</p>
            <p className="font-display text-2xl text-yd-forest">{value}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

export function AdminAnalyticsPage() {
  return <AdminDashboardPage />;
}
