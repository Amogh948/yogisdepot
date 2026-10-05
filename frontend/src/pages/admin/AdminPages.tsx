import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminApi } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Input";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { entityId, mediaUrl, type Category, type OrderStatus, type Product } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ConfirmDialog } from "../../components/ui/Overlay";
import { useEffect, useState } from "react";
import { ApiError } from "../../services/api/client";
import { formatCad, formatCadFromCents } from "../../utils/money";

type AdminStackVariant = {
  variantId: string;
  variantCode: string;
  name: string;
  barcode?: string;
  status: "active" | "inactive";
  skuId?: string;
  skuCode?: string;
  taxCategoryId?: string;
  pricing: {
    mrpCents: number;
    costPriceCents: number;
    sellingPriceCents: number;
  } | null;
  inventory: {
    availableQuantity: number;
    reservedQuantity: number;
    reorderLevel: number;
    warehouseCode: string;
  };
};

type AdminProductStack = {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  productCode?: string;
  brandName?: string;
  brand?: string;
  description: string;
  shortDescription?: string;
  ingredients?: string;
  storageInstructions?: string;
  usageInstructions?: string;
  manufacturer?: string;
  countryOfOrigin?: string;
  tags?: string[];
  imageUrls?: string[];
  isFeatured?: boolean;
  isActive?: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  categoryId?: { name?: string; slug?: string; id?: string; _id?: string } | string;
  vendorId?: { businessName?: string; id?: string; _id?: string } | string;
  variants: AdminStackVariant[];
  source?: { system?: string; sourceId?: string };
};

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
        <div key={point._id} className="flex-1 rounded-t bg-saffron-500" style={{ height: `${((point.revenue || 0) / max) * 100}%` }} title={`${point._id}: ${formatCad(point.revenue)}`} />
      ))}
    </div>
  );
}

function adminCardImage(src?: string, alt?: string) {
  if (!src) {
    return <div className="flex aspect-[4/3] items-center justify-center bg-yd-cream text-xs text-yd-muted">No image</div>;
  }
  return <img src={mediaUrl(src)} alt={alt || ""} className="aspect-[4/3] w-full object-cover" loading="lazy" />;
}

function productThumb(product: Product): string {
  if (product.thumbnail) return product.thumbnail;
  const first = product.images?.[0] as unknown;
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "url" in first) return String((first as { url?: string }).url || "");
  return "";
}

function categoryName(value: Product["categoryId"]): string {
  if (!value) return "";
  if (typeof value === "string") return "";
  return value.name || "";
}

function vendorName(value: Product["vendorId"]): string {
  if (!value || typeof value === "string") return "";
  return value.businessName || "";
}

export function AdminDashboardPage() {
  const query = useQuery({ queryKey: ["admin-analytics"], queryFn: () => adminApi.analytics() });
  if (query.isLoading) return <Skeleton className="h-64" />;
  const data = (query.data?.data || {}) as Record<string, unknown>;
  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue" value={formatCad(Number(data.revenue || 0))} />
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

export function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-products", search, page],
    queryFn: () => adminApi.products({ limit: 30, page, search: search || undefined }),
  });
  const toast = useToastStore((s) => s.push);
  const items = query.data?.items || [];
  const pagination = query.data?.pagination;

  const remove = async () => {
    if (!deleteId) return;
    try {
      await adminApi.deleteProduct(deleteId);
      toast("Product removed");
      setDeleteId(null);
      await query.refetch();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not delete product", "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        action={
          <Link to="/admin/products/new" className="text-sm font-semibold text-yd-green">
            New product wizard
          </Link>
        }
      />
      <div className="mb-4">
        <Input
          label="Search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Name, brand, or SKU"
        />
      </div>
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? <EmptyState title="No products" body="Try another search or create a product." /> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((product) => {
          const id = entityId(product);
          return (
            <article key={product.slug} className="relative overflow-hidden rounded-2xl border border-yd-border/60 bg-white shadow-soft">
              <Link to={`/admin/products/${id}/edit`} className="block">
                {adminCardImage(productThumb(product), product.name)}
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold">{product.name}</p>
                  <p className="text-sm font-medium">{formatCad(product.price)}</p>
                  <p className="text-xs text-yd-muted">
                    Stock {product.stock}
                    {categoryName(product.categoryId) ? ` · ${categoryName(product.categoryId)}` : ""}
                  </p>
                  {vendorName(product.vendorId) ? <p className="truncate text-xs text-yd-muted">{vendorName(product.vendorId)}</p> : null}
                  <Badge tone={product.isActive ? "sage" : "muted"}>{product.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </Link>
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-yd-error shadow-soft"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDeleteId(id);
                }}
              >
                Delete
              </button>
            </article>
          );
        })}
      </div>
      {pagination && pagination.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete product"
        body="This permanently removes the product from the catalog. Existing orders keep their line-item snapshots."
        confirmLabel="Delete"
        onClose={() => setDeleteId(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

export function AdminProductWizardPage() {
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.push);
  const vendors = useQuery({ queryKey: ["admin-vendors"], queryFn: () => adminApi.vendors() });
  const categories = useQuery({ queryKey: ["admin-categories"], queryFn: () => adminApi.categories() });
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brandName: "",
    categoryId: "",
    vendorId: "",
    description: "",
    ingredients: "",
    storageInstructions: "",
    variantName: "Default pack",
    skuCode: "",
    mrpCents: 499,
    costPriceCents: 299,
    sellingPriceCents: 399,
    availableQuantity: 50,
    batchNumber: "",
    purchasePriceCents: 250,
    batchQty: 50,
  });

  const set = (key: keyof typeof form, value: string | number) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setSaving(true);
    try {
      await adminApi.createProductWizard({
        name: form.name,
        brandName: form.brandName || undefined,
        categoryId: form.categoryId,
        vendorId: form.vendorId,
        description: form.description || form.name,
        ingredients: form.ingredients || undefined,
        storageInstructions: form.storageInstructions || undefined,
        variants: [
          {
            name: form.variantName,
            skuCode: form.skuCode || undefined,
            mrpCents: Number(form.mrpCents),
            costPriceCents: Number(form.costPriceCents),
            sellingPriceCents: Number(form.sellingPriceCents),
            availableQuantity: Number(form.availableQuantity),
            batch: form.batchNumber
              ? {
                  batchNumber: form.batchNumber,
                  purchasePriceCents: Number(form.purchasePriceCents),
                  quantity: Number(form.batchQty),
                }
              : undefined,
          },
        ],
      });
      toast("Product created");
      navigate("/admin/products");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not create product", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-24">
      <PageHeader title="Create product" />
      <p className="text-sm text-yd-muted">Step {step} of 7 · amounts in CAD cents (e.g. 399 = $3.99)</p>
      {step === 1 ? (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
          <Input label="Product name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <Input label="Brand" value={form.brandName} onChange={(e) => set("brandName", e.target.value)} />
          <Select label="Vendor" value={form.vendorId} onChange={(e) => set("vendorId", e.target.value)}>
            <option value="">Select vendor</option>
            {(vendors.data?.items || []).map((v) => (
              <option key={entityId(v)} value={entityId(v)}>
                {v.businessName}
              </option>
            ))}
          </Select>
          <Select label="Category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">Select category</option>
            {((categories.data?.data || []) as Array<{ name: string; id?: string; _id?: string }>).map((c) => (
              <option key={String(c.id || c._id)} value={String(c.id || c._id || "")}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} />
          <Input label="Ingredients" value={form.ingredients} onChange={(e) => set("ingredients", e.target.value)} />
          <Input label="Storage" value={form.storageInstructions} onChange={(e) => set("storageInstructions", e.target.value)} />
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
          <Input label="Variant name" value={form.variantName} onChange={(e) => set("variantName", e.target.value)} />
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
          <Input label="SKU code" value={form.skuCode} onChange={(e) => set("skuCode", e.target.value)} placeholder="COC-ORG-750-PET" />
        </div>
      ) : null}
      {step === 4 ? (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
          <Input label="Cost price (cents)" type="number" value={form.costPriceCents} onChange={(e) => set("costPriceCents", Number(e.target.value))} />
          <Input label="MRP (cents)" type="number" value={form.mrpCents} onChange={(e) => set("mrpCents", Number(e.target.value))} />
          <Input label="Selling price (cents)" type="number" value={form.sellingPriceCents} onChange={(e) => set("sellingPriceCents", Number(e.target.value))} />
        </div>
      ) : null}
      {step === 5 ? (
        <div className="rounded-2xl bg-white p-4 shadow-soft text-sm text-yd-muted">
          Tax category defaults to STANDARD (Canadian taxability). Configure rates under Tax admin APIs.
        </div>
      ) : null}
      {step === 6 ? (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
          <Input label="Available quantity (YYZ-WH-01)" type="number" value={form.availableQuantity} onChange={(e) => set("availableQuantity", Number(e.target.value))} />
        </div>
      ) : null}
      {step === 7 ? (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
          <Input label="Batch number" value={form.batchNumber} onChange={(e) => set("batchNumber", e.target.value)} />
          <Input label="Purchase price (cents)" type="number" value={form.purchasePriceCents} onChange={(e) => set("purchasePriceCents", Number(e.target.value))} />
          <Input label="Batch quantity" type="number" value={form.batchQty} onChange={(e) => set("batchQty", Number(e.target.value))} />
        </div>
      ) : null}
      <div className="fixed bottom-0 left-0 right-0 border-t border-yd-border bg-white p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-xl gap-2">
          <Button variant="outline" disabled={step === 1 || saving} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            Back
          </Button>
          {step < 7 ? (
            <Button className="flex-1" disabled={saving} onClick={() => setStep((s) => Math.min(7, s + 1))}>
              Next
            </Button>
          ) : (
            <Button className="flex-1" disabled={saving || !form.name || !form.vendorId || !form.categoryId} onClick={() => void submit()}>
              {saving ? "Saving…" : "Create product"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function refId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as { id?: string; _id?: string };
    return String(obj.id || obj._id || "");
  }
  return "";
}

export function AdminProductEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const vendors = useQuery({ queryKey: ["admin-vendors"], queryFn: () => adminApi.vendors({ limit: "100" }) });
  const categories = useQuery({ queryKey: ["admin-categories"], queryFn: () => adminApi.categories() });
  const taxCategories = useQuery({ queryKey: ["admin-tax-categories"], queryFn: () => adminApi.taxCategories() });
  const collectionsQuery = useQuery({ queryKey: ["admin-merchandising"], queryFn: () => adminApi.merchandising() });
  const membershipQuery = useQuery({
    queryKey: ["admin-product-merchandising", id],
    queryFn: () => adminApi.productMerchandising(id),
    enabled: Boolean(id),
  });
  const stackQuery = useQuery({
    queryKey: ["admin-product-stack", id],
    queryFn: async () => {
      const result = await adminApi.productStack(id);
      return result.data as AdminProductStack;
    },
    enabled: Boolean(id),
  });

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brandName: "",
    categoryId: "",
    vendorId: "",
    description: "",
    shortDescription: "",
    ingredients: "",
    storageInstructions: "",
    usageInstructions: "",
    manufacturer: "",
    countryOfOrigin: "",
    tags: "",
    images: "",
    isFeatured: false,
    isActive: true,
    isVegetarian: true,
    isVegan: false,
  });
  const [variants, setVariants] = useState<
    Array<{
      variantId: string;
      name: string;
      status: "active" | "inactive";
      barcode: string;
      skuCode: string;
      taxCategoryId: string;
      mrpCents: number;
      costPriceCents: number;
      sellingPriceCents: number;
      availableQuantity: number;
      reorderLevel: number;
      reservedQuantity: number;
      warehouseCode: string;
    }>
  >([]);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);

  useEffect(() => {
    setCollectionIds((membershipQuery.data?.data || []).map((row) => entityId(row)).filter(Boolean));
  }, [membershipQuery.data]);

  useEffect(() => {
    const product = stackQuery.data;
    if (!product) return;
    setForm({
      name: product.name || "",
      brandName: product.brandName || product.brand || "",
      categoryId: refId(product.categoryId),
      vendorId: refId(product.vendorId),
      description: product.description || "",
      shortDescription: product.shortDescription || "",
      ingredients: product.ingredients || "",
      storageInstructions: product.storageInstructions || "",
      usageInstructions: product.usageInstructions || "",
      manufacturer: product.manufacturer || "",
      countryOfOrigin: product.countryOfOrigin || "",
      tags: (product.tags || []).join(", "),
      images: (product.imageUrls || []).join(", "),
      isFeatured: Boolean(product.isFeatured),
      isActive: product.isActive !== false,
      isVegetarian: product.isVegetarian !== false,
      isVegan: Boolean(product.isVegan),
    });
    setVariants(
      (product.variants || []).map((v) => ({
        variantId: v.variantId,
        name: v.name,
        status: v.status,
        barcode: v.barcode || "",
        skuCode: v.skuCode || "",
        taxCategoryId: v.taxCategoryId || "",
        mrpCents: v.pricing?.mrpCents ?? 0,
        costPriceCents: v.pricing?.costPriceCents ?? 0,
        sellingPriceCents: v.pricing?.sellingPriceCents ?? 0,
        availableQuantity: v.inventory?.availableQuantity ?? 0,
        reorderLevel: v.inventory?.reorderLevel ?? 10,
        reservedQuantity: v.inventory?.reservedQuantity ?? 0,
        warehouseCode: v.inventory?.warehouseCode || "YYZ-WH-01",
      })),
    );
  }, [stackQuery.data]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setVariant = (variantId: string, patch: Partial<(typeof variants)[number]>) => {
    setVariants((prev) => prev.map((v) => (v.variantId === variantId ? { ...v, ...patch } : v)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateProductStack(id, {
        name: form.name,
        brandName: form.brandName || undefined,
        categoryId: form.categoryId,
        vendorId: form.vendorId,
        description: form.description || form.name,
        shortDescription: form.shortDescription || undefined,
        ingredients: form.ingredients || undefined,
        storageInstructions: form.storageInstructions || undefined,
        usageInstructions: form.usageInstructions || undefined,
        manufacturer: form.manufacturer || undefined,
        countryOfOrigin: form.countryOfOrigin || undefined,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        images: form.images
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        isFeatured: form.isFeatured,
        isActive: form.isActive,
        isVegetarian: form.isVegetarian,
        isVegan: form.isVegan,
        variants: variants.map((v) => ({
          variantId: v.variantId,
          name: v.name,
          status: v.status,
          barcode: v.barcode || undefined,
          taxCategoryId: v.taxCategoryId || undefined,
          mrpCents: Number(v.mrpCents),
          costPriceCents: Number(v.costPriceCents),
          sellingPriceCents: Number(v.sellingPriceCents),
          availableQuantity: Number(v.availableQuantity),
          reorderLevel: Number(v.reorderLevel),
        })),
      });
      await adminApi.setProductMerchandising(id, collectionIds);
      toast("Product saved");
      await queryClient.invalidateQueries({ queryKey: ["admin-product-stack", id] });
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-product-merchandising", id] });
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save product", "error");
    } finally {
      setSaving(false);
    }
  };

  if (stackQuery.isLoading) return <Skeleton className="h-64" />;
  if (stackQuery.isError || !stackQuery.data) {
    return (
      <EmptyState
        title="Product not found"
        body="This product may have been removed."
        action={
          <Button variant="outline" onClick={() => navigate("/admin/products")}>
            Back to products
          </Button>
        }
      />
    );
  }

  const product = stackQuery.data;
  const taxOptions = (taxCategories.data?.data || []) as Array<{ name: string; id?: string; _id?: string; code?: string }>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-28">
      <PageHeader
        title="Edit product"
        action={
          <Link to="/admin/products" className="text-sm font-semibold text-yd-muted">
            Back
          </Link>
        }
      />
      <div className="rounded-2xl bg-white p-4 shadow-soft text-sm text-yd-muted">
        <p>
          <span className="font-semibold text-charcoal-900">{product.productCode || product.slug}</span>
          {product.source?.system ? ` · imported from ${product.source.system}` : null}
        </p>
        <p className="mt-1">Prices in CAD cents (399 = $3.99). Inventory updates YYZ-WH-01 available qty.</p>
      </div>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <h2 className="font-display text-lg">Basics</h2>
        <Input label="Product name" value={form.name} onChange={(e) => setField("name", e.target.value)} />
        <Input label="Brand" value={form.brandName} onChange={(e) => setField("brandName", e.target.value)} />
        <Select label="Vendor" value={form.vendorId} onChange={(e) => setField("vendorId", e.target.value)}>
          <option value="">Select vendor</option>
          {(vendors.data?.items || []).map((v) => (
            <option key={entityId(v)} value={entityId(v)}>
              {v.businessName}
            </option>
          ))}
        </Select>
        <Select label="Category" value={form.categoryId} onChange={(e) => setField("categoryId", e.target.value)}>
          <option value="">Select category</option>
          {((categories.data?.data || []) as Array<{ name: string; id?: string; _id?: string }>).map((c) => (
            <option key={String(c.id || c._id)} value={String(c.id || c._id || "")}>
              {c.name}
            </option>
          ))}
        </Select>
        <Textarea label="Description" value={form.description} onChange={(e) => setField("description", e.target.value)} rows={4} />
        <Input
          label="Short description"
          value={form.shortDescription}
          onChange={(e) => setField("shortDescription", e.target.value)}
        />
        <Textarea label="Ingredients" value={form.ingredients} onChange={(e) => setField("ingredients", e.target.value)} rows={3} />
        <Input label="Storage" value={form.storageInstructions} onChange={(e) => setField("storageInstructions", e.target.value)} />
        <Input label="Usage" value={form.usageInstructions} onChange={(e) => setField("usageInstructions", e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Manufacturer" value={form.manufacturer} onChange={(e) => setField("manufacturer", e.target.value)} />
          <Input
            label="Country of origin"
            value={form.countryOfOrigin}
            onChange={(e) => setField("countryOfOrigin", e.target.value)}
          />
        </div>
        <Input label="Tags (comma separated)" value={form.tags} onChange={(e) => setField("tags", e.target.value)} />
        <Textarea
          label="Image URLs (comma separated)"
          value={form.images}
          onChange={(e) => setField("images", e.target.value)}
          rows={2}
        />
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <h2 className="font-display text-lg">Merchandising</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setField("isActive", e.target.checked)} /> Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isFeatured} onChange={(e) => setField("isFeatured", e.target.checked)} /> Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isVegetarian}
            onChange={(e) => setField("isVegetarian", e.target.checked)}
          />{" "}
          Vegetarian
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isVegan} onChange={(e) => setField("isVegan", e.target.checked)} /> Vegan
        </label>
        <div className="border-t border-yd-border pt-3">
          <p className="mb-2 text-sm font-semibold">Collections</p>
          <p className="mb-2 text-xs text-yd-muted">
            Assign this product to merchandising rails.{" "}
            <Link to="/admin/merchandising/new" className="font-semibold text-yd-green">
              Create a collection
            </Link>
          </p>
          {(collectionsQuery.data?.data || []).length ? (
            <div className="space-y-2">
              {(collectionsQuery.data?.data || []).map((collection) => {
                const cid = entityId(collection);
                const checked = collectionIds.includes(cid);
                return (
                  <label key={cid} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setCollectionIds((prev) =>
                          e.target.checked ? [...prev, cid] : prev.filter((item) => item !== cid),
                        );
                      }}
                    />
                    {collection.name}
                    <span className="text-xs capitalize text-yd-muted">({collection.placement})</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-yd-muted">No collections yet. Create one from Merchandising.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Variants & SKUs</h2>
        {!variants.length ? (
          <div className="rounded-2xl bg-white p-4 text-sm text-yd-muted shadow-soft">No variants on this product.</div>
        ) : null}
        {variants.map((variant, index) => (
          <div key={variant.variantId} className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">Variant {index + 1}</p>
                <p className="text-xs text-yd-muted">
                  {variant.skuCode || "No SKU"} · {variant.warehouseCode}
                  {variant.reservedQuantity > 0 ? ` · ${variant.reservedQuantity} reserved` : ""}
                </p>
              </div>
              <Badge>{variant.status}</Badge>
            </div>
            <Input label="Variant name" value={variant.name} onChange={(e) => setVariant(variant.variantId, { name: e.target.value })} />
            <Input label="SKU code" value={variant.skuCode} disabled />
            <Input
              label="Barcode"
              value={variant.barcode}
              onChange={(e) => setVariant(variant.variantId, { barcode: e.target.value })}
            />
            <Select
              label="Status"
              value={variant.status}
              onChange={(e) => setVariant(variant.variantId, { status: e.target.value as "active" | "inactive" })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <Select
              label="Tax category"
              value={variant.taxCategoryId}
              onChange={(e) => setVariant(variant.variantId, { taxCategoryId: e.target.value })}
            >
              <option value="">Default</option>
              {taxOptions.map((t) => (
                <option key={String(t.id || t._id)} value={String(t.id || t._id || "")}>
                  {t.name}
                  {t.code ? ` (${t.code})` : ""}
                </option>
              ))}
            </Select>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Cost (¢)"
                type="number"
                value={variant.costPriceCents}
                onChange={(e) => setVariant(variant.variantId, { costPriceCents: Number(e.target.value) })}
              />
              <Input
                label="MRP (¢)"
                type="number"
                value={variant.mrpCents}
                onChange={(e) => setVariant(variant.variantId, { mrpCents: Number(e.target.value) })}
              />
              <Input
                label="Selling (¢)"
                type="number"
                value={variant.sellingPriceCents}
                onChange={(e) => setVariant(variant.variantId, { sellingPriceCents: Number(e.target.value) })}
              />
            </div>
            <p className="text-xs text-yd-muted">
              Preview: cost {formatCadFromCents(variant.costPriceCents)} · MRP {formatCadFromCents(variant.mrpCents)} · sell{" "}
              {formatCadFromCents(variant.sellingPriceCents)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Available quantity"
                type="number"
                value={variant.availableQuantity}
                onChange={(e) => setVariant(variant.variantId, { availableQuantity: Number(e.target.value) })}
              />
              <Input
                label="Reorder level"
                type="number"
                value={variant.reorderLevel}
                onChange={(e) => setVariant(variant.variantId, { reorderLevel: Number(e.target.value) })}
              />
            </div>
          </div>
        ))}
      </section>

      <div className="fixed bottom-0 left-0 right-0 border-t border-yd-border bg-white p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button variant="outline" disabled={saving} onClick={() => navigate("/admin/products")}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={saving || !form.name || !form.categoryId || !form.vendorId} onClick={() => void save()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminCategoriesPage() {
  const query = useQuery({ queryKey: ["admin-categories"], queryFn: () => adminApi.categories() });
  const toast = useToastStore((s) => s.push);
  const items = (query.data?.data || []) as Category[];
  return (
    <div className="space-y-6">
      <PageHeader title="Categories" />
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? <EmptyState title="No categories" body="Create a category to organize the catalog." /> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.slug}
            to={`/admin/categories/${entityId(item)}`}
            className="overflow-hidden rounded-2xl border border-yd-border/60 bg-white shadow-soft transition hover:border-yd-green/40"
          >
            {adminCardImage(item.image, item.name)}
            <div className="space-y-1 p-3">
              <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold">{item.name}</p>
              <p className="truncate text-xs text-yd-muted">{item.slug}</p>
              <Badge tone={item.isActive ? "sage" : "muted"}>{item.isActive ? "Active" : "Inactive"}</Badge>
            </div>
          </Link>
        ))}
      </div>
      <form
        className="max-w-md space-y-3 rounded-2xl bg-white p-4 shadow-soft"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          await adminApi.createCategory({ name: String(form.get("name")), parentId: String(form.get("parentId") || "") || undefined });
          toast("Category created");
          query.refetch();
          event.currentTarget.reset();
        }}
      >
        <p className="font-semibold">Add category</p>
        <Input label="Name" name="name" required />
        <Select label="Parent (optional)" name="parentId">
          <option value="">None</option>
          {items.map((item) => (
            <option key={entityId(item)} value={entityId(item)}>
              {item.name}
            </option>
          ))}
        </Select>
        <Button>Create</Button>
      </form>
    </div>
  );
}

type AdminCategory = Category & { parentId?: { name?: string; slug?: string; id?: string; _id?: string } | string | null };

export function AdminCategoryDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const all = useQuery({ queryKey: ["admin-categories"], queryFn: () => adminApi.categories() });
  const query = useQuery({
    queryKey: ["admin-category", id],
    queryFn: async () => (await adminApi.category(id)).data as AdminCategory,
    enabled: Boolean(id),
  });
  const category = query.data;
  if (query.isLoading) return <Skeleton className="h-40" />;
  if (!category) {
    return (
      <EmptyState
        title="Category not found"
        body="This category may have been removed."
        action={
          <Button variant="outline" onClick={() => navigate("/admin/categories")}>
            Back
          </Button>
        }
      />
    );
  }
  const parentId = typeof category.parentId === "object" && category.parentId ? entityId(category.parentId) : String(category.parentId || "");
  return (
    <form
      className="mx-auto max-w-lg space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await adminApi.updateCategory(id, {
            name: String(form.get("name")),
            description: String(form.get("description") || "") || undefined,
            image: String(form.get("image") || "") || undefined,
            parentId: String(form.get("parentId") || "") || null,
            isActive: form.get("isActive") === "on",
          });
          toast("Category saved");
          await queryClient.invalidateQueries({ queryKey: ["admin-category", id] });
          await queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
        } catch (error) {
          toast(error instanceof ApiError ? error.message : "Could not save category", "error");
        }
      }}
    >
      <PageHeader
        title={category.name}
        action={
          <Link to="/admin/categories" className="text-sm font-semibold text-yd-muted">
            Back
          </Link>
        }
      />
      {category.image ? <img src={mediaUrl(category.image)} alt="" className="h-32 w-full rounded-2xl object-cover" /> : null}
      <Input label="Name" name="name" defaultValue={category.name} required />
      <Input label="Slug" defaultValue={category.slug} disabled />
      <Textarea label="Description" name="description" defaultValue={category.description} rows={3} />
      <Input label="Image URL" name="image" defaultValue={category.image} />
      <Select label="Parent" name="parentId" defaultValue={parentId}>
        <option value="">None</option>
        {((all.data?.data || []) as Category[])
          .filter((item) => entityId(item) !== id)
          .map((item) => (
            <option key={entityId(item)} value={entityId(item)}>
              {item.name}
            </option>
          ))}
      </Select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={category.isActive !== false} /> Active
      </label>
      <Button>Save category</Button>
    </form>
  );
}

export function AdminOrdersPage() {
  const query = useQuery({ queryKey: ["admin-orders"], queryFn: () => adminApi.orders({ limit: 40 }) });
  const items = query.data?.items || [];
  return (
    <div>
      <PageHeader title="Orders" />
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? <EmptyState title="No orders" body="Customer orders will appear here." /> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((order) => (
          <Link
            key={order.orderNumber}
            to={`/admin/orders/${entityId(order)}`}
            className="overflow-hidden rounded-2xl border border-yd-border/60 bg-white shadow-soft transition hover:border-yd-green/40"
          >
            {adminCardImage(order.items[0]?.productImage, order.items[0]?.productName)}
            <div className="space-y-1 p-3">
              <p className="font-semibold">{order.orderNumber}</p>
              <p className="text-sm">{formatCad(order.total)}</p>
              <p className="text-xs text-yd-muted">
                {order.items.length} item{order.items.length === 1 ? "" : "s"}
                {order.createdAt ? ` · ${new Date(order.createdAt).toLocaleDateString("en-CA")}` : ""}
              </p>
              <Badge>{order.orderStatus.replace(/_/g, " ")}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AdminOrderDetailPage() {
  const { id = "" } = useParams();
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-order", id], queryFn: () => adminApi.order(id), enabled: Boolean(id) });
  const order = query.data?.data;
  if (query.isLoading) return <Skeleton className="h-40" />;
  if (!order) {
    return <EmptyState title="Order not found" body="This order may have been removed." />;
  }
  const address = order.shippingAddress;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title={order.orderNumber}
        action={
          <Link to="/admin/orders" className="text-sm font-semibold text-yd-muted">
            Back
          </Link>
        }
      />
      <div className="rounded-2xl bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge>{order.orderStatus.replace(/_/g, " ")}</Badge>
          <p className="font-display text-xl">{formatCad(order.total)}</p>
        </div>
        <p className="mt-2 text-sm text-yd-muted">
          Payment {order.paymentMethod} · {order.paymentStatus}
        </p>
        {order.createdAt ? <p className="text-sm text-yd-muted">{new Date(order.createdAt).toLocaleString("en-CA")}</p> : null}
      </div>
      <Select
        label="Order status"
        value={order.orderStatus}
        onChange={async (event) => {
          try {
            await adminApi.orderStatus(entityId(order), event.target.value as OrderStatus);
            toast("Order updated");
            await queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
            await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not update order", "error");
          }
        }}
      >
        {["pending", "confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"].map((status) => (
          <option key={status} value={status}>
            {status.replace(/_/g, " ")}
          </option>
        ))}
      </Select>
      <section className="space-y-2">
        <h2 className="font-display text-lg">Items</h2>
        {order.items.map((item, index) => (
          <article key={`${item.productId}-${index}`} className="flex gap-3 rounded-2xl bg-white p-3 shadow-soft">
            {item.productImage ? (
              <img src={mediaUrl(item.productImage)} alt="" className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-yd-cream" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{item.productName}</p>
              <p className="text-sm text-yd-muted">
                × {item.quantity} · {formatCad(item.totalPrice)}
              </p>
              <p className="text-xs capitalize text-yd-muted">{item.fulfillmentStatus.replace(/_/g, " ")}</p>
            </div>
          </article>
        ))}
      </section>
      {address ? (
        <section className="rounded-2xl bg-white p-4 shadow-soft text-sm">
          <h2 className="mb-2 font-display text-lg">Shipping</h2>
          <p className="font-semibold">{address.fullName}</p>
          <p className="text-yd-muted">{address.phone}</p>
          <p className="text-yd-muted">
            {address.addressLine1}
            {address.addressLine2 ? `, ${address.addressLine2}` : ""}
          </p>
          <p className="text-yd-muted">
            {address.city}, {address.state} {address.postalCode}
          </p>
        </section>
      ) : null}
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
          deliveryFeeCents: Number(form.get("deliveryFeeCents")),
          freeShippingThresholdCents: Number(form.get("freeShippingThresholdCents")),
          platformFeeCents: Number(form.get("platformFeeCents")),
          handlingFeeCents: Number(form.get("handlingFeeCents")),
          smallCartFeeCents: Number(form.get("smallCartFeeCents")),
          smallCartThresholdCents: Number(form.get("smallCartThresholdCents")),
          supportEmail: String(form.get("supportEmail")),
        });
        toast("Settings saved");
      }}
    >
      <PageHeader title="Settings" />
      <p className="text-sm text-yd-muted">Fees are CAD cents. Sales tax is configured via versioned Canadian tax rates — not a flat taxRate.</p>
      <Input label="Site name" name="siteName" defaultValue={String(settings.siteName || "")} />
      <Input label="Delivery fee (cents)" name="deliveryFeeCents" type="number" defaultValue={String(settings.deliveryFeeCents ?? 499)} />
      <Input label="Free shipping threshold (cents)" name="freeShippingThresholdCents" type="number" defaultValue={String(settings.freeShippingThresholdCents ?? 7500)} />
      <Input label="Platform fee (cents)" name="platformFeeCents" type="number" defaultValue={String(settings.platformFeeCents ?? 99)} />
      <Input label="Handling fee (cents)" name="handlingFeeCents" type="number" defaultValue={String(settings.handlingFeeCents ?? 49)} />
      <Input label="Small cart fee (cents)" name="smallCartFeeCents" type="number" defaultValue={String(settings.smallCartFeeCents ?? 199)} />
      <Input label="Small cart threshold (cents)" name="smallCartThresholdCents" type="number" defaultValue={String(settings.smallCartThresholdCents ?? 2500)} />
      <Input label="Support email" name="supportEmail" defaultValue={String(settings.supportEmail || "")} />
      <Button>Save</Button>
    </form>
  );
}
