import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { adminApi } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Badge, Skeleton } from "../../components/ui/Feedback";
import { entityId, type OrderStatus } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ConfirmDialog } from "../../components/ui/Overlay";
import { useState } from "react";
import { ApiError } from "../../services/api/client";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft">
      <p className="text-sm text-charcoal-700/70">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}

function Bars({ data }: { data: Array<{ _id: string; revenue?: number; orders?: number }> }) {
  const max = Math.max(...data.map((d) => d.revenue || 0), 1);
  return (
    <div className="flex h-40 items-end gap-1 rounded-2xl bg-white p-4 shadow-soft">
      {data.map((point) => (
        <div key={point._id} className="flex-1 rounded-t bg-saffron-500" style={{ height: `${((point.revenue || 0) / max) * 100}%` }} title={`${point._id}: ₹${point.revenue}`} />
      ))}
    </div>
  );
}

export function AdminDashboardPage() {
  const query = useQuery({ queryKey: ["admin-analytics"], queryFn: () => adminApi.analytics() });
  if (query.isLoading) return <Skeleton className="h-64" />;
  const data = (query.data?.data || {}) as Record<string, unknown>;
  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue" value={`₹${Number(data.revenue || 0).toFixed(0)}`} />
        <Stat label="Orders" value={Number(data.totalOrders || 0)} />
        <Stat label="Customers" value={Number(data.totalCustomers || 0)} />
        <Stat label="Vendors" value={Number(data.totalVendors || 0)} />
        <Stat label="Active products" value={Number(data.activeProducts || 0)} />
        <Stat label="Low stock" value={Number(data.lowStockProducts || 0)} />
        <Stat label="Pending vendors" value={Number(data.pendingVendorApprovals || 0)} />
        <Stat label="Pending orders" value={Number(data.pendingOrders || 0)} />
      </div>
      <Bars data={(data.salesChart as Array<{ _id: string; revenue?: number }>) || []} />
    </div>
  );
}

export function AdminVendorsPage() {
  const [status, setStatus] = useState("");
  const query = useQuery({ queryKey: ["admin-vendors", status], queryFn: () => adminApi.vendors(status ? { status } : undefined) });
  return (
    <div>
      <PageHeader title="Vendors" />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {["", "pending", "active", "rejected", "suspended"].map((value) => (
          <button key={value} className={`rounded-full px-3 py-1 text-sm ${status === value ? "bg-saffron-600 text-white" : "bg-white"}`} onClick={() => setStatus(value)} type="button">
            {value || "all"}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {(query.data?.items || []).map((vendor) => (
          <Link key={entityId(vendor)} to={`/admin/vendors/${entityId(vendor)}`} className="block rounded-2xl bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{vendor.businessName}</p>
                <p className="text-sm text-charcoal-700/70">{vendor.email}</p>
              </div>
              <Badge>{vendor.status}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AdminVendorDetailPage() {
  const { id = "" } = useParams();
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-vendor", id], queryFn: () => adminApi.vendor(id) });
  const [confirm, setConfirm] = useState<string | null>(null);
  const mutate = useMutation({
    mutationFn: (status: string) => adminApi.vendorStatus(id, { status }),
    onSuccess: async () => {
      toast("Vendor updated");
      await queryClient.invalidateQueries({ queryKey: ["admin-vendor", id] });
      setConfirm(null);
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Update failed", "error"),
  });
  const vendor = query.data?.data;
  if (!vendor) return <Skeleton className="h-40" />;
  return (
    <div className="space-y-4">
      <PageHeader title={vendor.businessName} />
      <p className="text-sm">{vendor.email} · {vendor.phone}</p>
      <p className="capitalize">{vendor.status} / {vendor.approvalStatus}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => mutate.mutate("approved")}>Approve</Button>
        <Button variant="outline" onClick={() => mutate.mutate("rejected")}>Reject</Button>
        <Button variant="danger" onClick={() => setConfirm("suspended")}>Suspend</Button>
        <Button variant="secondary" onClick={() => mutate.mutate("active")}>Reactivate</Button>
      </div>
      <ConfirmDialog open={Boolean(confirm)} title="Suspend vendor" body="This vendor will not be able to sell until reactivated." onClose={() => setConfirm(null)} onConfirm={() => mutate.mutate("suspended")} />
    </div>
  );
}

export function AdminProductsPage() {
  const query = useQuery({ queryKey: ["admin-products"], queryFn: () => adminApi.products({ limit: 20 }) });
  const toast = useToastStore((s) => s.push);
  return (
    <div>
      <PageHeader title="Products" />
      <div className="space-y-2">
        {(query.data?.items || []).map((product) => (
          <article key={product.slug} className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-soft">
            <div>
              <p className="font-semibold">{product.name}</p>
              <p className="text-sm">₹{product.price} · stock {product.stock}</p>
            </div>
            <Button variant="outline" size="sm" onClick={async () => { await adminApi.productStatus(entityId(product), !product.isActive); toast("Updated"); query.refetch(); }}>
              {product.isActive ? "Deactivate" : "Activate"}
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}

export function AdminCategoriesPage() {
  const query = useQuery({ queryKey: ["admin-categories"], queryFn: () => adminApi.categories() });
  const toast = useToastStore((s) => s.push);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <PageHeader title="Categories" />
        {(query.data?.data || []).map((cat) => {
          const item = cat as { name: string; slug: string; parentId?: string };
          return (
            <p key={item.slug} className="rounded-xl bg-white px-3 py-2 shadow-soft">
              {item.name} <span className="text-xs text-charcoal-700/50">{item.slug}</span>
            </p>
          );
        })}
      </div>
      <form
        className="space-y-3 rounded-2xl bg-white p-4 shadow-soft"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          await adminApi.createCategory({ name: String(form.get("name")), parentId: String(form.get("parentId") || "") || undefined });
          toast("Category created");
          query.refetch();
        }}
      >
        <Input label="Name" name="name" required />
        <Input label="Parent ID (optional)" name="parentId" />
        <Button>Create</Button>
      </form>
    </div>
  );
}

export function AdminOrdersPage() {
  const query = useQuery({ queryKey: ["admin-orders"], queryFn: () => adminApi.orders() });
  const toast = useToastStore((s) => s.push);
  return (
    <div>
      <PageHeader title="Orders" />
      <div className="space-y-2">
        {(query.data?.items || []).map((order) => (
          <article key={order.orderNumber} className="rounded-2xl bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{order.orderNumber}</p>
              <select
                className="h-10 rounded-xl border px-2 text-sm"
                defaultValue={order.orderStatus}
                onChange={async (event) => {
                  await adminApi.orderStatus(entityId(order), event.target.value as OrderStatus);
                  toast("Order updated");
                }}
              >
                {["pending", "confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"].map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <p className="text-sm">₹{order.total}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function AdminCustomersPage() {
  const query = useQuery({ queryKey: ["admin-customers"], queryFn: () => adminApi.customers() });
  return (
    <div>
      <PageHeader title="Customers" />
      {(query.data?.items || []).map((user) => (
        <article key={user.id} className="mb-2 flex items-center justify-between rounded-2xl bg-white p-3 shadow-soft">
          <div>
            <p className="font-semibold">{user.firstName} {user.lastName}</p>
            <p className="text-sm">{user.email}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => adminApi.setCustomerActive(user.id, !user.isActive)}>{user.isActive ? "Disable" : "Enable"}</Button>
        </article>
      ))}
    </div>
  );
}

export function AdminCouponsPage() {
  const query = useQuery({ queryKey: ["admin-coupons"], queryFn: () => adminApi.coupons() });
  const toast = useToastStore((s) => s.push);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <PageHeader title="Coupons" />
        {(query.data || []).map((coupon) => (
          <p key={coupon.couponCode} className="mb-2 rounded-2xl bg-white p-3 shadow-soft">
            {coupon.couponCode} · {coupon.discountType} {coupon.discountValue}
          </p>
        ))}
      </div>
      <form
        className="space-y-3 rounded-2xl bg-white p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          await adminApi.createCoupon({
            couponCode: String(form.get("couponCode")),
            discountType: String(form.get("discountType")),
            discountValue: Number(form.get("discountValue")),
            minimumOrderValue: Number(form.get("minimumOrderValue") || 0),
            startDate: String(form.get("startDate")),
            endDate: String(form.get("endDate")),
          });
          toast("Coupon created");
          query.refetch();
        }}
      >
        <Input label="Code" name="couponCode" required />
        <Select label="Type" name="discountType">
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed</option>
        </Select>
        <Input label="Value" name="discountValue" type="number" required />
        <Input label="Min order" name="minimumOrderValue" type="number" />
        <Input label="Start" name="startDate" type="datetime-local" required />
        <Input label="End" name="endDate" type="datetime-local" required />
        <Button>Create coupon</Button>
      </form>
    </div>
  );
}

export function AdminReviewsPage() {
  const query = useQuery({ queryKey: ["admin-reviews"], queryFn: () => adminApi.reviews() });
  return (
    <div>
      <PageHeader title="Reviews" />
      {(query.data || []).map((review) => {
        const item = review as { _id: string; comment: string; rating: number; isApproved: boolean };
        return (
          <article key={item._id} className="mb-2 rounded-2xl bg-white p-3 shadow-soft">
            <p>{item.rating}★ {item.comment}</p>
            <Button size="sm" variant="outline" onClick={() => adminApi.moderateReview(item._id, !item.isApproved)}>
              {item.isApproved ? "Hide" : "Approve"}
            </Button>
          </article>
        );
      })}
    </div>
  );
}

export function AdminAnalyticsPage() {
  return <AdminDashboardPage />;
}

export function AdminSettingsPage() {
  const query = useQuery({ queryKey: ["settings"], queryFn: () => adminApi.settings() });
  const toast = useToastStore((s) => s.push);
  const settings = (query.data?.data || {}) as Record<string, string | number>;
  if (query.isLoading) return <Skeleton className="h-40" />;
  return (
    <form
      className="max-w-lg space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await adminApi.updateSettings({
          siteName: String(form.get("siteName")),
          taxRate: Number(form.get("taxRate")),
          shippingFee: Number(form.get("shippingFee")),
          freeShippingThreshold: Number(form.get("freeShippingThreshold")),
          supportEmail: String(form.get("supportEmail")),
        });
        toast("Settings saved");
      }}
    >
      <PageHeader title="Settings" />
      <Input label="Site name" name="siteName" defaultValue={String(settings.siteName || "")} />
      <Input label="Tax rate (0-1)" name="taxRate" type="number" step="0.01" defaultValue={String(settings.taxRate ?? 0.05)} />
      <Input label="Shipping fee" name="shippingFee" type="number" defaultValue={String(settings.shippingFee ?? 40)} />
      <Input label="Free shipping threshold" name="freeShippingThreshold" type="number" defaultValue={String(settings.freeShippingThreshold ?? 499)} />
      <Input label="Support email" name="supportEmail" defaultValue={String(settings.supportEmail || "")} />
      <Button>Save</Button>
    </form>
  );
}
