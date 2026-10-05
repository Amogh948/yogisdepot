import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { vendorApi } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Input";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { entityId } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { useCategories } from "../../hooks/useCatalog";
import { formatCad } from "../../utils/money";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft">
      <p className="text-sm text-charcoal-700/70">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}

export function VendorDashboardPage() {
  const query = useQuery({ queryKey: ["vendor-analytics"], queryFn: () => vendorApi.analytics() });
  if (query.isLoading) return <Skeleton className="h-48" />;
  const data = (query.data?.data || {}) as Record<string, number>;
  return (
    <div className="space-y-4">
      <PageHeader title="Vendor dashboard" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue" value={formatCad(Number(data.revenue || 0))} />
        <Stat label="Orders" value={data.orders || 0} />
        <Stat label="Units sold" value={data.unitsSold || 0} />
        <Stat label="Low stock" value={data.lowStockProducts || 0} />
      </div>
    </div>
  );
}

export function VendorProductsPage() {
  const query = useQuery({ queryKey: ["vendor-products"], queryFn: () => vendorApi.products({ limit: 50 }) });
  const toast = useToastStore((s) => s.push);
  return (
    <div>
      <PageHeader title="Products" action={<Link className="text-sm font-semibold text-saffron-700" to="/vendor/products/create">Add product</Link>} />
      {(query.data?.items || []).map((product) => (
        <article key={product.slug} className="mb-2 flex items-center justify-between rounded-2xl bg-white p-3 shadow-soft">
          <div>
            <p className="font-semibold">{product.name}</p>
            <p className="text-sm">{formatCad(product.price)} · {product.stock} in stock</p>
          </div>
          <div className="flex gap-2">
            <Link className="text-sm font-semibold" to={`/vendor/products/${entityId(product)}/edit`}>Edit</Link>
            <button className="text-sm" type="button" onClick={async () => { await vendorApi.productStatus(entityId(product), !product.isActive); toast("Updated"); query.refetch(); }}>
              {product.isActive ? "Hide" : "Show"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function VendorProductFormPage() {
  const { id } = useParams();
  const categories = useCategories();
  const toast = useToastStore((s) => s.push);
  const navigate = useNavigate();
  const existing = useQuery({
    queryKey: ["vendor-products"],
    queryFn: () => vendorApi.products({ limit: 100 }),
    enabled: Boolean(id),
  });
  const product = existing.data?.items.find((item) => entityId(item) === id);
  const parents = categories.data?.data || [];

  return (
    <form
      className="max-w-2xl space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const payload = {
          name: String(form.get("name")),
          description: String(form.get("description")),
          sku: String(form.get("sku")),
          categoryId: String(form.get("categoryId")),
          price: Number(form.get("price")),
          compareAtPrice: Number(form.get("compareAtPrice") || 0) || undefined,
          stock: Number(form.get("stock")),
          images: String(form.get("images") || "").split(",").map((s) => s.trim()).filter(Boolean),
          ingredients: String(form.get("ingredients") || "") || undefined,
          isVegetarian: form.get("isVegetarian") === "on",
          isVegan: form.get("isVegan") === "on",
          brand: String(form.get("brand") || "") || undefined,
        };
        try {
          if (id) await vendorApi.updateProduct(id, payload);
          else await vendorApi.createProduct(payload);
          toast(id ? "Product updated" : "Product created");
          navigate("/vendor/products");
        } catch (error) {
          toast(error instanceof ApiError ? error.message : "Save failed", "error");
        }
      }}
    >
      <PageHeader title={id ? "Edit product" : "Create product"} />
      <Input label="Name" name="name" defaultValue={product?.name} required />
      <Input label="SKU" name="sku" defaultValue={product?.sku} required />
      <Select label="Category" name="categoryId" defaultValue={typeof product?.categoryId === "object" ? undefined : undefined}>
        {parents.map((cat) => (
          <option key={cat.slug} value={entityId(cat)}>{cat.name}</option>
        ))}
      </Select>
      <Textarea label="Description" name="description" defaultValue={product?.description} required />
      <Input label="Price" name="price" type="number" defaultValue={product?.price} required />
      <Input label="Compare at price" name="compareAtPrice" type="number" defaultValue={product?.compareAtPrice} />
      <Input label="Stock" name="stock" type="number" defaultValue={product?.stock} required />
      <Input label="Brand" name="brand" defaultValue={product?.brand} />
      <Input label="Image URLs (comma separated)" name="images" defaultValue={product?.images.join(", ")} />
      <Textarea label="Ingredients" name="ingredients" defaultValue={product?.ingredients} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isVegetarian" defaultChecked={product?.isVegetarian ?? true} /> Vegetarian</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isVegan" defaultChecked={product?.isVegan} /> Vegan</label>
      <Button>Save product</Button>
    </form>
  );
}

export function VendorOrdersPage() {
  const query = useQuery({ queryKey: ["vendor-orders"], queryFn: () => vendorApi.orders() });
  if (!query.data?.items.length) return <EmptyState title="No orders yet" body="Orders containing your products will appear here." />;
  return (
    <div>
      <PageHeader title="Orders" />
      {query.data.items.map((order) => (
        <Link key={order.orderNumber} to={`/vendor/orders/${entityId(order)}`} className="mb-2 block rounded-2xl bg-white p-4 shadow-soft">
          <p className="font-semibold">{order.orderNumber}</p>
          <p className="text-sm">{order.items.length} of your items</p>
        </Link>
      ))}
    </div>
  );
}

export function VendorOrderDetailPage() {
  const { id = "" } = useParams();
  const toast = useToastStore((s) => s.push);
  const query = useQuery({ queryKey: ["vendor-order", id], queryFn: () => vendorApi.order(id) });
  const order = query.data?.data;
  if (!order) return <Skeleton className="h-40" />;
  return (
    <div className="space-y-3">
      <PageHeader title={order.orderNumber} />
      {order.items.map((item) => (
        <p key={item.productId} className="rounded-2xl bg-white p-3">{item.productName} × {item.quantity}</p>
      ))}
      <Select
        label="Fulfillment status"
        defaultValue={order.items[0]?.fulfillmentStatus}
        onChange={async (event) => {
          await vendorApi.orderStatus(id, event.target.value);
          toast("Status updated");
        }}
      >
        {["pending", "confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered"].map((status) => (
          <option key={status} value={status}>{status}</option>
        ))}
      </Select>
    </div>
  );
}

export function VendorInventoryPage() {
  const query = useQuery({ queryKey: ["vendor-products"], queryFn: () => vendorApi.products({ limit: 100 }) });
  const toast = useToastStore((s) => s.push);
  return (
    <div>
      <PageHeader title="Inventory" />
      {(query.data?.items || []).map((product) => (
        <form
          key={product.slug}
          className="mb-2 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 shadow-soft"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await vendorApi.adjustInventory(entityId(product), {
              type: String(form.get("type")),
              quantity: Number(form.get("quantity")),
              reason: String(form.get("reason") || "manual"),
            });
            toast("Stock updated");
            query.refetch();
          }}
        >
          <div className="flex-1">
            <p className="font-semibold">{product.name}</p>
            <p className="text-sm">Stock {product.stock} {product.stock <= product.lowStockThreshold ? <Badge tone="red">low</Badge> : null}</p>
          </div>
          <select name="type" className="h-10 rounded-xl border px-2 text-sm">
            <option value="restock">Restock</option>
            <option value="adjustment">Adjustment</option>
            <option value="damage">Damage</option>
          </select>
          <input name="quantity" type="number" className="h-10 w-24 rounded-xl border px-2" required />
          <Button size="sm">Apply</Button>
        </form>
      ))}
    </div>
  );
}

export function VendorAnalyticsPage() {
  return <VendorDashboardPage />;
}

export function VendorProfilePage() {
  const query = useQuery({ queryKey: ["vendor-me"], queryFn: () => vendorApi.me() });
  const toast = useToastStore((s) => s.push);
  const vendor = query.data?.data;
  if (!vendor) return <Skeleton className="h-40" />;
  return (
    <form
      className="max-w-lg space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await vendorApi.updateMe({ description: String(form.get("description")), phone: String(form.get("phone")) });
        toast("Profile updated");
      }}
    >
      <PageHeader title="Store profile" />
      <p className="font-semibold">{vendor.businessName}</p>
      <Input label="Phone" name="phone" defaultValue={vendor.phone} />
      <Textarea label="Description" name="description" defaultValue={vendor.description} />
      <Button>Save</Button>
    </form>
  );
}
