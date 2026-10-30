import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminApi } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Input";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { CsvDropzone } from "../../components/ui/CsvDropzone";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { entityId, mediaUrl, type Category, type Coupon, type OrderStatus, type Product } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ConfirmDialog, Modal } from "../../components/ui/Overlay";
import { useEffect, useState } from "react";
import { ApiError } from "../../services/api/client";
import { formatCad, formatCadFromCents } from "../../utils/money";
import { Download } from "lucide-react";
import { AdminBackLink } from "../../components/admin/AdminBackLink";
import { useAdminBack } from "../../hooks/useAdminBack";

function isGroceryCategory(category: { name?: string; slug?: string }) {
  const hay = `${category.slug || ""} ${category.name || ""}`.toLowerCase();
  return /\bgrocer/.test(hay);
}

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
  productCode?: string;
  slug?: string;
  brand?: string;
  brandName?: string;
  brandId?: { name?: string; slug?: string; id?: string; _id?: string } | string;
  festivalId?: string | null;
  categoryId?: { name?: string; slug?: string; id?: string; _id?: string } | string;
  categoryIds?: Array<{ name?: string; slug?: string; id?: string; _id?: string } | string>;
  vendorId?: { businessName?: string; id?: string; _id?: string } | string;
  description?: string;
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
  unlimitedQuantity?: boolean;
  isVegan?: boolean;
  returnWindowDays?: number;
  deliveryEstimateDays?: number;
  source?: { system?: string; sourceId?: string };
  variants?: AdminStackVariant[];
};

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

export function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{
    total: number;
    created: number;
    updated: number;
    failed: number;
    rows: Array<{
      rowNumber: number;
      action: "create" | "update" | "skip";
      skuCode?: string;
      name?: string;
      ok: boolean;
      errors: string[];
    }>;
  } | null>(null);
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

  const downloadCsvTemplate = async () => {
    setCsvBusy(true);
    try {
      const blob = await adminApi.downloadProductCsvTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "yogisdepot-products-template.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      toast("CSV template downloaded");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not download CSV template", "error");
    } finally {
      setCsvBusy(false);
    }
  };

  const previewCsv = async () => {
    if (!csvFile) {
      toast("Choose a CSV file first", "error");
      return;
    }
    setCsvBusy(true);
    try {
      const result = await adminApi.previewProductCsv(csvFile);
      setCsvPreview(result.data);
      toast(
        result.data.failed
          ? `Preview ready · ${result.data.failed} row(s) need fixes`
          : `Preview ready · ${result.data.created} create, ${result.data.updated} update`,
      );
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "CSV preview failed", "error");
    } finally {
      setCsvBusy(false);
    }
  };

  const importCsv = async () => {
    if (!csvFile) {
      toast("Choose a CSV file first", "error");
      return;
    }
    setCsvBusy(true);
    try {
      const result = await adminApi.importProductCsv(csvFile);
      setCsvPreview(result.data);
      toast(
        `Import finished · ${result.data.created} created, ${result.data.updated} updated, ${result.data.failed} failed`,
      );
      await query.refetch();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "CSV import failed", "error");
    } finally {
      setCsvBusy(false);
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
      <section className="mb-5 rounded-2xl border border-yd-border/60 bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-yd-ink">Bulk import</p>
            <p className="mt-0.5 text-sm text-yd-muted">
              Update existing products or add new ones from a CSV. Use pipe-separated{" "}
              <span className="font-medium text-yd-ink">imageUrls</span> for product images.
            </p>
          </div>
          <button
            type="button"
            disabled={csvBusy}
            onClick={() => void downloadCsvTemplate()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-yd-green hover:underline disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download template
          </button>
        </div>

        <CsvDropzone
          file={csvFile}
          disabled={csvBusy}
          onFile={(next) => {
            setCsvFile(next);
            setCsvPreview(null);
          }}
        />

        {csvFile ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={csvBusy} onClick={() => void previewCsv()}>
              {csvBusy ? "Working…" : "Preview"}
            </Button>
            <Button type="button" disabled={csvBusy} onClick={() => void importCsv()}>
              Import
            </Button>
          </div>
        ) : null}

        {csvPreview ? (
          <div className="mt-4 space-y-2 border-t border-yd-border/70 pt-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge tone="muted">{csvPreview.total} rows</Badge>
              <Badge tone="sage">{csvPreview.created} create</Badge>
              <Badge tone="sage">{csvPreview.updated} update</Badge>
              <Badge tone={csvPreview.failed ? "red" : "sage"}>{csvPreview.failed} failed</Badge>
            </div>
            {csvPreview.rows.some((row) => !row.ok) ? (
              <ul className="max-h-36 space-y-1 overflow-y-auto text-yd-error">
                {csvPreview.rows
                  .filter((row) => !row.ok)
                  .slice(0, 12)
                  .map((row) => (
                    <li key={row.rowNumber}>
                      Row {row.rowNumber}
                      {row.skuCode ? ` · ${row.skuCode}` : ""}: {row.errors.join("; ")}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-yd-muted">All rows look valid. Click Import to apply.</p>
            )}
          </div>
        ) : null}
      </section>
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
  const brands = useQuery({ queryKey: ["admin-brands"], queryFn: () => adminApi.brands() });
  const festivals = useQuery({ queryKey: ["admin-merchandising"], queryFn: () => adminApi.merchandising() });
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const taxCategories = useQuery({ queryKey: ["admin-tax-categories"], queryFn: () => adminApi.taxCategories() });
  const [form, setForm] = useState({
    name: "",
    brandId: "",
    brandName: "",
    categoryId: "",
    categoryIds: [] as string[],
    vendorId: "",
    festivalId: "",
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
    taxable: true,
    returnWindowDays: 0,
    deliveryEstimateDays: 5,
  });

  const set = (key: keyof typeof form, value: string | number | boolean | string[]) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (!form.categoryIds.length) {
      toast("Select at least one category", "error");
      return;
    }
    if (Number(form.mrpCents) < Number(form.sellingPriceCents)) {
      toast("Original price must be greater than or equal to the selling price", "error");
      return;
    }
    setSaving(true);
    try {
      const categoryIds = form.categoryIds.map((item) => refId(item)).filter(Boolean);
      const taxOptions = taxCategories.data?.data || [];
      const categoryOptionId = (predicate: (t: (typeof taxOptions)[number]) => boolean) => {
        const match = taxOptions.find(predicate);
        return match ? String(match.id || match._id || "") : "";
      };
      const taxableCategoryId =
        categoryOptionId((t) => t.code === "STANDARD") || categoryOptionId((t) => t.taxability === "TAXABLE");
      const nonTaxableCategoryId =
        categoryOptionId((t) => t.code === "GROCERY_ZERO") ||
        categoryOptionId((t) => t.code === "EXEMPT") ||
        categoryOptionId((t) => t.taxability === "ZERO_RATED" || t.taxability === "EXEMPT");
      const taxCategoryId = form.taxable ? taxableCategoryId : nonTaxableCategoryId;
      await adminApi.createProductWizard({
        name: form.name,
        returnWindowDays: Math.max(0, Math.floor(Number(form.returnWindowDays) || 0)),
        deliveryEstimateDays: Math.max(1, Math.floor(Number(form.deliveryEstimateDays) || 5)),
        brandId: form.brandId || undefined,
        brandName: form.brandName || undefined,
        categoryId: categoryIds[0],
        categoryIds,
        vendorId: form.vendorId,
        festivalId: form.festivalId || null,
        description: form.description || form.name,
        ingredients: form.ingredients || undefined,
        storageInstructions: form.storageInstructions || undefined,
        variants: [
          {
            name: form.variantName,
            skuCode: form.skuCode || undefined,
            taxCategoryId: taxCategoryId || undefined,
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
    <div className="w-full space-y-4 pb-24">
      <PageHeader title="Create product" action={<AdminBackLink fallback="/admin/products" />} />
      <p className="text-sm text-yd-muted">Step {step} of 7 · amounts in CAD cents (e.g. 399 = $3.99)</p>
      {step === 1 ? (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
          <Input label="Product name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <Select
            label="Brand"
            value={form.brandId}
            onChange={(e) => {
              const brandId = e.target.value;
              const brand = ((brands.data?.data || []) as Array<{ name: string; id?: string; _id?: string }>).find(
                (item) => entityId(item) === brandId,
              );
              setForm((prev) => ({ ...prev, brandId, brandName: brand?.name || prev.brandName }));
            }}
          >
            <option value="">Select brand</option>
            {((brands.data?.data || []) as Array<{ name: string; id?: string; _id?: string }>).map((brand) => (
              <option key={entityId(brand)} value={entityId(brand)}>
                {brand.name}
              </option>
            ))}
          </Select>
          <Input
            label="Or new brand name"
            value={form.brandName}
            onChange={(e) => setForm((prev) => ({ ...prev, brandName: e.target.value, brandId: "" }))}
          />
          <Select label="Vendor" value={form.vendorId} onChange={(e) => set("vendorId", e.target.value)}>
            <option value="">Select vendor</option>
            {(vendors.data?.items || []).map((v) => (
              <option key={entityId(v)} value={entityId(v)}>
                {v.businessName}
              </option>
            ))}
          </Select>
          <div>
            <p className="mb-2 text-sm font-medium">Categories</p>
            <p className="mb-2 text-xs text-yd-muted">Select one or more categories</p>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-yd-border p-3">
              {((categories.data?.data || []) as Array<{ name: string; slug?: string; id?: string; _id?: string }>).map(
                (c) => {
                const cid = String(c.id || c._id || "");
                const checked = form.categoryIds.includes(cid);
                return (
                  <label key={cid} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const nextIds = e.target.checked
                          ? [...form.categoryIds, cid]
                          : form.categoryIds.filter((id) => id !== cid);
                        set("categoryIds", nextIds);
                        // Groceries default to non-taxable; admin can override per product.
                        if (e.target.checked && isGroceryCategory(c)) {
                          set("taxable", false);
                        }
                      }}
                    />
                    {c.name}
                  </label>
                );
              },
              )}
            </div>
          </div>
          <Select label="Festival (optional)" value={form.festivalId} onChange={(e) => set("festivalId", e.target.value)}>
            <option value="">None</option>
            {(festivals.data?.data || [])
              .filter((c) => c.placement === "festival")
              .map((festival) => (
                <option key={entityId(festival)} value={entityId(festival)}>
                  {festival.name}
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
          <div>
            <Input label="Original price / MRP (cents)" type="number" value={form.mrpCents} onChange={(e) => set("mrpCents", Number(e.target.value))} />
            <p className="mt-1 text-[11px] text-yd-muted">
              Original price displayed with a strikethrough when higher than the selling price.
            </p>
          </div>
          <Input label="Selling price (cents)" type="number" value={form.sellingPriceCents} onChange={(e) => set("sellingPriceCents", Number(e.target.value))} />
          <div>
            <Input
              label="Return window (days)"
              type="number"
              min={0}
              value={form.returnWindowDays}
              onChange={(e) => set("returnWindowDays", Math.max(0, Number(e.target.value) || 0))}
            />
            <p className="mt-1 text-[11px] text-yd-muted">Enter 0 for non-returnable items.</p>
          </div>
          <div>
            <Input
              label="Estimated delivery (days)"
              type="number"
              min={1}
              value={form.deliveryEstimateDays}
              onChange={(e) => set("deliveryEstimateDays", Math.max(1, Number(e.target.value) || 5))}
            />
            <p className="mt-1 text-[11px] text-yd-muted">Number of days from the order date used to estimate delivery.</p>
          </div>
        </div>
      ) : null}
      {step === 5 ? (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
          <Select
            label="Taxability"
            value={form.taxable ? "taxable" : "non_taxable"}
            onChange={(e) => set("taxable", e.target.value === "taxable")}
          >
            <option value="taxable">Taxable — province tax applies at checkout</option>
            <option value="non_taxable">Non-taxable — no tax on this product</option>
          </Select>
          <p className="text-xs text-yd-muted">
            Groceries default to non-taxable (0% on the item). Mark individual grocery products Taxable when they should
            be taxed. Platform and delivery fees are always taxed. Provincial rates: Admin → Provincial taxes.
          </p>
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
        <div className="flex w-full gap-2">
          <Button variant="outline" disabled={step === 1 || saving} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            Back
          </Button>
          {step < 7 ? (
            <Button className="flex-1" disabled={saving} onClick={() => setStep((s) => Math.min(7, s + 1))}>
              Next
            </Button>
          ) : (
            <Button className="flex-1" disabled={saving || !form.name || !form.vendorId || !form.categoryIds.length} onClick={() => void submit()}>
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
    const obj = value as { id?: unknown; _id?: unknown };
    if (typeof obj._id === "string" && obj._id) return obj._id;
    if (obj._id && typeof obj._id === "object" && "$oid" in (obj._id as object)) {
      return String((obj._id as { $oid: string }).$oid);
    }
    if (obj._id != null) return String(obj._id);
    if (typeof obj.id === "string" && obj.id) return obj.id;
    if (obj.id != null) return String(obj.id);
  }
  return "";
}

export function AdminProductEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const goBack = useAdminBack("/admin/products");
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const vendors = useQuery({ queryKey: ["admin-vendors"], queryFn: () => adminApi.vendors({ limit: "100" }) });
  const categories = useQuery({ queryKey: ["admin-categories"], queryFn: () => adminApi.categories() });
  const brands = useQuery({ queryKey: ["admin-brands"], queryFn: () => adminApi.brands() });
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
    brandId: "",
    brandName: "",
    categoryId: "",
    categoryIds: [] as string[],
    vendorId: "",
    festivalId: "",
    description: "",
    shortDescription: "",
    ingredients: "",
    storageInstructions: "",
    usageInstructions: "",
    manufacturer: "",
    countryOfOrigin: "",
    tags: "",
    images: [] as string[],
    isFeatured: false,
    isActive: true,
    isVegetarian: true,
    isVegan: false,
    unlimitedQuantity: true,
    returnWindowDays: 0,
    deliveryEstimateDays: 5,
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
    const fromIds = (product.categoryIds || []).map((item) => refId(item)).filter(Boolean);
    const fallback = refId(product.categoryId);
    setForm({
      name: product.name || "",
      brandId: refId(product.brandId),
      brandName: product.brandName || product.brand || "",
      categoryId: fallback,
      categoryIds: fromIds.length ? fromIds : fallback ? [fallback] : [],
      vendorId: refId(product.vendorId),
      festivalId: refId(product.festivalId),
      description: product.description || "",
      shortDescription: product.shortDescription || "",
      ingredients: product.ingredients || "",
      storageInstructions: product.storageInstructions || "",
      usageInstructions: product.usageInstructions || "",
      manufacturer: product.manufacturer || "",
      countryOfOrigin: product.countryOfOrigin || "",
      tags: (product.tags || []).join(", "),
      images: product.imageUrls || [],
      isFeatured: Boolean(product.isFeatured),
      isActive: product.isActive !== false,
      isVegetarian: product.isVegetarian !== false,
      isVegan: Boolean(product.isVegan),
      unlimitedQuantity: product.unlimitedQuantity !== false,
      returnWindowDays: typeof product.returnWindowDays === "number" ? product.returnWindowDays : 0,
      deliveryEstimateDays: typeof product.deliveryEstimateDays === "number" ? product.deliveryEstimateDays : 5,
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
      if (!form.categoryIds.length) {
        toast("Select at least one category", "error");
        setSaving(false);
        return;
      }
      const categoryIds = form.categoryIds.map((item) => refId(item)).filter(Boolean);
      await adminApi.updateProductStack(id, {
        name: form.name,
        brandId: form.brandId || undefined,
        brandName: form.brandName || undefined,
        categoryId: categoryIds[0],
        categoryIds,
        vendorId: form.vendorId,
        festivalId: form.festivalId || null,
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
        images: form.images,
        isFeatured: form.isFeatured,
        isActive: form.isActive,
        isVegetarian: form.isVegetarian,
        isVegan: form.isVegan,
        unlimitedQuantity: form.unlimitedQuantity,
        returnWindowDays: Math.max(0, Math.floor(Number(form.returnWindowDays) || 0)),
        deliveryEstimateDays: Math.max(1, Math.floor(Number(form.deliveryEstimateDays) || 5)),
        variants: variants.map((v) => ({
          variantId: v.variantId,
          name: v.name,
          status: v.status,
          barcode: v.barcode || undefined,
          taxCategoryId: v.taxCategoryId || undefined,
          mrpCents: Number(v.mrpCents),
          costPriceCents: Number(v.costPriceCents),
          sellingPriceCents: Number(v.sellingPriceCents),
          ...(form.unlimitedQuantity
            ? {}
            : {
                availableQuantity: Number(v.availableQuantity),
                reorderLevel: Number(v.reorderLevel),
              }),
        })),
      });
      await adminApi.setProductMerchandising(id, collectionIds);
      toast("Product saved");
      await queryClient.invalidateQueries({ queryKey: ["admin-product-stack", id] });
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-product-merchandising", id] });
      navigate("/admin/products");
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
          <Button variant="outline" onClick={goBack}>
            Back to products
          </Button>
        }
      />
    );
  }

  const product = stackQuery.data;
  const taxOptions = (taxCategories.data?.data || []) as Array<{
    name: string;
    id?: string;
    _id?: string;
    code?: string;
    taxability?: "TAXABLE" | "ZERO_RATED" | "EXEMPT";
  }>;
  const categoryOptionId = (predicate: (t: (typeof taxOptions)[number]) => boolean) => {
    const match = taxOptions.find(predicate);
    return match ? String(match.id || match._id || "") : "";
  };
  const taxableCategoryId =
    categoryOptionId((t) => t.code === "STANDARD") || categoryOptionId((t) => t.taxability === "TAXABLE");
  const nonTaxableCategoryId =
    categoryOptionId((t) => t.code === "GROCERY_ZERO") ||
    categoryOptionId((t) => t.code === "EXEMPT") ||
    categoryOptionId((t) => t.taxability === "ZERO_RATED" || t.taxability === "EXEMPT");

  return (
    <div className="w-full space-y-4 pb-28">
      <PageHeader
        title="Edit product"
        action={<AdminBackLink fallback="/admin/products" />}
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
        <Select
          label="Brand"
          value={form.brandId}
          onChange={(e) => {
            const brandId = e.target.value;
            const brand = ((brands.data?.data || []) as Array<{ name: string; id?: string; _id?: string }>).find(
              (item) => entityId(item) === brandId,
            );
            setForm((prev) => ({ ...prev, brandId, brandName: brand?.name || prev.brandName }));
          }}
        >
          <option value="">Select brand</option>
          {((brands.data?.data || []) as Array<{ name: string; id?: string; _id?: string }>).map((brand) => (
            <option key={entityId(brand)} value={entityId(brand)}>
              {brand.name}
            </option>
          ))}
        </Select>
        <Input
          label="Or new brand name"
          value={form.brandName}
          onChange={(e) => setForm((prev) => ({ ...prev, brandName: e.target.value, brandId: "" }))}
        />
        <Select label="Vendor" value={form.vendorId} onChange={(e) => setField("vendorId", e.target.value)}>
          <option value="">Select vendor</option>
          {(vendors.data?.items || []).map((v) => (
            <option key={entityId(v)} value={entityId(v)}>
              {v.businessName}
            </option>
          ))}
        </Select>
        <div>
          <p className="mb-2 text-sm font-medium">Categories</p>
          <p className="mb-2 text-xs text-yd-muted">Select one or more categories</p>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-yd-border p-3">
            {((categories.data?.data || []) as Array<{ name: string; id?: string; _id?: string }>).map((c) => {
              const cid = String(c.id || c._id || "");
              const checked = form.categoryIds.includes(cid);
              return (
                <label key={cid} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setField(
                        "categoryIds",
                        e.target.checked
                          ? [...form.categoryIds, cid]
                          : form.categoryIds.filter((item) => item !== cid),
                      );
                    }}
                  />
                  {c.name}
                </label>
              );
            })}
          </div>
        </div>
        <Select
          label="Festival (optional)"
          value={form.festivalId}
          onChange={(e) => setField("festivalId", e.target.value)}
        >
          <option value="">None</option>
          {(collectionsQuery.data?.data || [])
            .filter((c) => c.placement === "festival")
            .map((festival) => (
              <option key={entityId(festival)} value={entityId(festival)}>
                {festival.name}
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
        <ImageUpload
          label="Product images"
          multiple
          maxFiles={8}
          value={form.images}
          onChange={(urls) => setField("images", urls)}
          hint="Uploads to Cloudinary when configured"
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
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.unlimitedQuantity}
            onChange={(e) => setField("unlimitedQuantity", e.target.checked)}
          />
          <span>
            <span className="font-medium">Unlimited quantity</span>
            <span className="mt-0.5 block text-xs text-yd-muted">
              On: no per-order or stock limit; available quantity and reorder level are not used. Off: max 99 per
              order and stock applies.
            </span>
          </span>
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

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <h2 className="font-display text-lg">Returns & delivery</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Input
              label="Return window (days)"
              type="number"
              min={0}
              value={form.returnWindowDays}
              onChange={(e) => setField("returnWindowDays", Math.max(0, Number(e.target.value) || 0))}
            />
            <p className="mt-1 text-[11px] text-yd-muted">Enter 0 for non-returnable items.</p>
          </div>
          <div>
            <Input
              label="Estimated delivery (days)"
              type="number"
              min={1}
              value={form.deliveryEstimateDays}
              onChange={(e) => setField("deliveryEstimateDays", Math.max(1, Number(e.target.value) || 5))}
            />
            <p className="mt-1 text-[11px] text-yd-muted">Number of days from the order date used to estimate delivery.</p>
          </div>
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
              label="Taxability"
              value={(() => {
                const selected = taxOptions.find((t) => String(t.id || t._id || "") === variant.taxCategoryId);
                if (!selected) return "taxable";
                return selected.taxability === "EXEMPT" || selected.taxability === "ZERO_RATED" || selected.code === "EXEMPT"
                  ? "non_taxable"
                  : "taxable";
              })()}
              onChange={(e) => {
                const nextId = e.target.value === "non_taxable" ? nonTaxableCategoryId : taxableCategoryId;
                if (!nextId) {
                  toast(
                    e.target.value === "non_taxable"
                      ? "No non-taxable tax category is configured yet. Seed Canadian tax categories first."
                      : "No taxable tax category is configured yet.",
                    "error",
                  );
                  return;
                }
                setVariant(variant.variantId, { taxCategoryId: nextId });
              }}
            >
              <option value="taxable">Taxable — province tax applies at checkout</option>
              <option value="non_taxable">Non-taxable — no tax on this product</option>
            </Select>
            <p className="text-xs text-yd-muted">
              Product-level flag controls tax at checkout. Non-taxable groceries are excluded; platform and delivery fees
              stay taxable.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Cost (¢)"
                type="number"
                value={variant.costPriceCents}
                onChange={(e) => setVariant(variant.variantId, { costPriceCents: Number(e.target.value) })}
              />
              <div>
                <Input
                  label="Original price / MRP (¢)"
                  type="number"
                  value={variant.mrpCents}
                  onChange={(e) => setVariant(variant.variantId, { mrpCents: Number(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-yd-muted">
                  Original price displayed with a strikethrough when higher than the selling price.
                </p>
              </div>
              <Input
                label="Selling price (¢)"
                type="number"
                value={variant.sellingPriceCents}
                onChange={(e) => setVariant(variant.variantId, { sellingPriceCents: Number(e.target.value) })}
              />
            </div>
            <p className="text-xs text-yd-muted">
              Preview: cost {formatCadFromCents(variant.costPriceCents)} · original {formatCadFromCents(variant.mrpCents)} · sell{" "}
              {formatCadFromCents(variant.sellingPriceCents)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Available quantity"
                type="number"
                value={variant.availableQuantity}
                disabled={form.unlimitedQuantity}
                hint={form.unlimitedQuantity ? "Not applicable while unlimited quantity is on" : undefined}
                className={form.unlimitedQuantity ? "cursor-not-allowed bg-yd-cream/60 text-yd-muted" : ""}
                onChange={(e) => setVariant(variant.variantId, { availableQuantity: Number(e.target.value) })}
              />
              <Input
                label="Reorder level"
                type="number"
                value={variant.reorderLevel}
                disabled={form.unlimitedQuantity}
                hint={form.unlimitedQuantity ? "Not applicable while unlimited quantity is on" : undefined}
                className={form.unlimitedQuantity ? "cursor-not-allowed bg-yd-cream/60 text-yd-muted" : ""}
                onChange={(e) => setVariant(variant.variantId, { reorderLevel: Number(e.target.value) })}
              />
            </div>
          </div>
        ))}
      </section>

      <div className="fixed bottom-0 left-0 right-0 border-t border-yd-border bg-white p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="flex w-full gap-2">
          <Button variant="outline" disabled={saving} onClick={goBack}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={saving || !form.name || !form.categoryIds.length || !form.vendorId} onClick={() => void save()}>
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    image: "",
    parentId: "",
    sortOrder: 0,
    isActive: true,
  });

  const allItems = (query.data?.data || []) as Category[];
  const needle = search.trim().toLowerCase();
  const items = allItems.filter((item) => {
    if (status === "active" && !item.isActive) return false;
    if (status === "inactive" && item.isActive) return false;
    if (!needle) return true;
    return item.name.toLowerCase().includes(needle) || item.slug.toLowerCase().includes(needle);
  });

  const resetCreateForm = () =>
    setCreateForm({ name: "", description: "", image: "", parentId: "", sortOrder: 0, isActive: true });

  const createCategory = async () => {
    setSaving(true);
    try {
      await adminApi.createCategory({
        name: createForm.name,
        description: createForm.description || undefined,
        image: createForm.image || undefined,
        parentId: createForm.parentId || null,
        sortOrder: Number(createForm.sortOrder),
        isActive: createForm.isActive,
      });
      toast("Category created");
      setCreateOpen(false);
      resetCreateForm();
      await query.refetch();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not create category", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        action={
          <Button
            size="sm"
            onClick={() => {
              resetCreateForm();
              setCreateOpen(true);
            }}
          >
            Add category
          </Button>
        }
      />
      <div className="space-y-3">
        <Input
          label="Filter categories"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or slug"
        />
        <div className="flex gap-2 overflow-x-auto">
          {(
            [
              ["all", "All"],
              ["active", "Active"],
              ["inactive", "Inactive"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`rounded-full px-3 py-1 text-sm ${status === value ? "bg-saffron-600 text-white" : "bg-white"}`}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? (
        <EmptyState
          title={allItems.length ? "No matching categories" : "No categories"}
          body={allItems.length ? "Try another search or status filter." : "Create a category to organize the catalog."}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const id = entityId(item);
          return (
            <article key={item.slug} className="relative overflow-hidden rounded-2xl border border-yd-border/60 bg-white shadow-soft">
              <Link to={`/admin/categories/${id}`} className="block transition hover:border-yd-green/40">
                {adminCardImage(item.image, item.name)}
                <div className="space-y-1 p-3 pr-16">
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold">{item.name}</p>
                  <p className="truncate text-xs text-yd-muted">{item.slug}</p>
                  <p className="text-xs font-medium text-yd-ink">
                    {item.productCount ?? 0} product{(item.productCount ?? 0) === 1 ? "" : "s"}
                  </p>
                  <Badge tone={item.isActive ? "sage" : "muted"}>{item.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </Link>
              <div className="absolute right-2 top-2 flex flex-col gap-1">
                <Link
                  to={`/admin/categories/${id}`}
                  className="rounded-full bg-white/95 px-2.5 py-1 text-center text-xs font-semibold text-yd-ink shadow-soft"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-yd-error shadow-soft"
                  onClick={(event) => {
                    event.preventDefault();
                    setDeleteId(id);
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <Modal
        open={createOpen}
        title="Add category"
        onClose={() => {
          if (saving) return;
          setCreateOpen(false);
        }}
      >
        <div className="space-y-3">
          <Input
            label="Name"
            value={createForm.name}
            onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <Textarea
            label="Description"
            value={createForm.description}
            onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
          />
          <ImageUpload
            label="Category image"
            value={createForm.image}
            onChange={(url) => setCreateForm((p) => ({ ...p, image: url }))}
          />
          <Select
            label="Parent"
            value={createForm.parentId}
            onChange={(e) => setCreateForm((p) => ({ ...p, parentId: e.target.value }))}
          >
            <option value="">None</option>
            {allItems.map((item) => (
              <option key={entityId(item)} value={entityId(item)}>
                {item.name}
              </option>
            ))}
          </Select>
          <Input
            label="Sort order"
            type="number"
            value={createForm.sortOrder}
            onChange={(e) => setCreateForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createForm.isActive}
              onChange={(e) => setCreateForm((p) => ({ ...p, isActive: e.target.checked }))}
            />{" "}
            Active
          </label>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" disabled={saving} onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={saving || !createForm.name.trim()} onClick={() => void createCategory()}>
              {saving ? "Creating…" : "Create category"}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete category"
        body="This permanently removes the category and any empty subcategories. Categories with products cannot be deleted until those products are removed or reassigned."
        confirmLabel="Delete"
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await adminApi.deleteCategory(deleteId);
            toast("Category deleted");
            setDeleteId(null);
            await query.refetch();
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not delete category", "error");
          }
        }}
      />
    </div>
  );
}

type AdminCategory = Category & {
  parentId?: { name?: string; slug?: string; id?: string; _id?: string } | string | null;
  sortOrder?: number;
};

export function AdminCategoryDetailPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const goBack = useAdminBack("/admin/categories");
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    image: "",
    parentId: "",
    sortOrder: 0,
    isActive: true,
  });

  const all = useQuery({ queryKey: ["admin-categories"], queryFn: () => adminApi.categories() });
  const query = useQuery({
    queryKey: ["admin-category", id],
    queryFn: async () => (await adminApi.category(id!)).data as AdminCategory,
    enabled: !isNew,
  });
  const productsQuery = useQuery({
    queryKey: ["admin-category-products", id],
    queryFn: () => adminApi.products({ category: id, limit: 100 }),
    enabled: !isNew && Boolean(id),
  });

  useEffect(() => {
    const category = query.data;
    if (!category) return;
    const parentId =
      typeof category.parentId === "object" && category.parentId
        ? entityId(category.parentId)
        : String(category.parentId || "");
    setForm({
      name: category.name || "",
      description: category.description || "",
      image: category.image || "",
      parentId,
      sortOrder: category.sortOrder ?? 0,
      isActive: category.isActive !== false,
    });
  }, [query.data]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        image: form.image || undefined,
        parentId: form.parentId || null,
        sortOrder: Number(form.sortOrder),
        isActive: form.isActive,
      };
      if (isNew) {
        await adminApi.createCategory(payload);
        toast("Category created");
        await queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
        navigate("/admin/categories");
      } else {
        await adminApi.updateCategory(id!, payload);
        toast("Category saved");
        await queryClient.invalidateQueries({ queryKey: ["admin-category", id] });
        await queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
        navigate("/admin/categories");
      }
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save category", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && query.isLoading) return <Skeleton className="h-40" />;
  if (!isNew && !query.data) {
    return (
      <EmptyState
        title="Category not found"
        body="This category may have been removed."
        action={
          <Button variant="outline" onClick={goBack}>
            Back
          </Button>
        }
      />
    );
  }

  const categoryProducts = productsQuery.data?.items || [];
  const productTotal = productsQuery.data?.pagination?.total ?? categoryProducts.length;

  return (
    <div className="w-full space-y-4 pb-24">
      <PageHeader
        title={isNew ? "Add category" : form.name || "Edit category"}
        action={<AdminBackLink fallback="/admin/categories" />}
      />
      {!isNew && form.image ? <img src={mediaUrl(form.image)} alt="" className="h-32 w-full rounded-2xl object-cover" /> : null}
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        {!isNew && query.data?.slug ? <Input label="Slug" value={query.data.slug} disabled /> : null}
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          rows={3}
        />
        <ImageUpload label="Category image" value={form.image} onChange={(url) => setForm((p) => ({ ...p, image: url }))} />
        <Select label="Parent" value={form.parentId} onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}>
          <option value="">None</option>
          {((all.data?.data || []) as Category[])
            .filter((item) => entityId(item) !== id)
            .map((item) => (
              <option key={entityId(item)} value={entityId(item)}>
                {item.name}
              </option>
            ))}
        </Select>
        <Input
          label="Sort order"
          type="number"
          value={form.sortOrder}
          onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
          />{" "}
          Active
        </label>
      </div>

      {!isNew ? (
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg">Products in this category</h2>
            <p className="text-xs text-yd-muted">
              {productTotal} product{productTotal === 1 ? "" : "s"}
            </p>
          </div>
          {productsQuery.isLoading ? <Skeleton className="h-24" /> : null}
          {!productsQuery.isLoading && !categoryProducts.length ? (
            <EmptyState title="No products yet" body="Assign products to this category from the product editor." />
          ) : null}
          <ul className="divide-y divide-yd-border/70">
            {categoryProducts.map((product) => {
              const productId = entityId(product);
              const thumb = productThumb(product);
              return (
                <li key={productId}>
                  <Link
                    to={`/admin/products/${productId}/edit`}
                    className="flex items-center gap-3 py-3 transition hover:bg-yd-cream/40"
                  >
                    {thumb ? (
                      <img
                        src={mediaUrl(thumb)}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-yd-cream text-[10px] text-yd-muted">
                        No img
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-yd-ink">{product.name}</p>
                      <p className="text-xs text-yd-muted">
                        {formatCad(product.price)}
                        {product.stock != null ? ` · Stock ${product.stock}` : ""}
                      </p>
                    </div>
                    <Badge tone={product.isActive ? "sage" : "muted"}>
                      {product.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <span className="text-xs font-semibold text-yd-green">Edit</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {productTotal > categoryProducts.length ? (
            <p className="text-xs text-yd-muted">
              Showing first {categoryProducts.length} of {productTotal}. Open Products and filter by this category for the
              full list.
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 border-t border-yd-border bg-white p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="flex w-full gap-2">
          {!isNew ? (
            <Button variant="danger" disabled={saving} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : null}
          <Button variant="outline" disabled={saving} onClick={goBack}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={saving || !form.name.trim()} onClick={() => void save()}>
            {saving ? "Saving…" : isNew ? "Create category" : "Save changes"}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete category"
        body="This permanently removes the category and any empty subcategories. Categories with products cannot be deleted until those products are removed or reassigned."
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await adminApi.deleteCategory(id!);
            toast("Category deleted");
            navigate("/admin/categories");
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not delete category", "error");
          }
        }}
      />
    </div>
  );
}

const ADMIN_ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const ADMIN_CANCEL_REASON_LABEL: Record<string, string> = {
  changed_my_mind: "Changed my mind",
  better_deal: "Got a better deal",
  ordered_by_mistake: "Ordered by mistake",
  delivery_too_long: "Delivery taking too long",
  other: "Other",
};

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
              <Badge>{ADMIN_ORDER_STATUS_LABEL[order.orderStatus] || order.orderStatus.replace(/_/g, " ")}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AdminOrderFulfillment({
  orderId,
  orderStatus,
  trackingNumber,
  trackingUrl,
  onUpdated,
}: {
  orderId: string;
  orderStatus: OrderStatus;
  trackingNumber?: string;
  trackingUrl?: string;
  onUpdated: () => Promise<void>;
}) {
  const toast = useToastStore((s) => s.push);
  const [number, setNumber] = useState(trackingNumber || "");
  const [url, setUrl] = useState(trackingUrl || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNumber(trackingNumber || "");
    setUrl(trackingUrl || "");
  }, [trackingNumber, trackingUrl]);

  const save = async (status: OrderStatus, announce: string) => {
    setSaving(true);
    try {
      await adminApi.orderStatus(orderId, {
        status,
        trackingNumber: number.trim() || undefined,
        trackingUrl: url.trim() || undefined,
      });
      toast(announce);
      await onUpdated();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not update order", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
      <Select
        label="Order status"
        value={orderStatus}
        disabled={saving}
        onChange={(event) => {
          void save(event.target.value as OrderStatus, "Order updated");
        }}
      >
        {(
          [
            ["pending", "Order Placed"],
            ["confirmed", "Confirmed"],
            ["processing", "Processing"],
            ["packed", "Packed"],
            ["shipped", "Shipped"],
            ["out_for_delivery", "Out for delivery"],
            ["delivered", "Delivered"],
            ["cancelled", "Cancelled"],
          ] as const
        ).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Input
        label="Tracking number"
        value={number}
        onChange={(event) => setNumber(event.target.value)}
        placeholder="Optional"
        maxLength={80}
      />
      <Input
        label="Tracking link"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://"
        maxLength={500}
      />
      <Button
        type="button"
        variant="secondary"
        loading={saving}
        onClick={() => {
          void save(orderStatus, "Tracking saved");
        }}
      >
        Save tracking
      </Button>
      <p className="text-xs text-yd-muted">
        Changing the status emails the customer. Saving a new tracking number or link emails them too.
      </p>
    </div>
  );
}

export function AdminOrderDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-order", id], queryFn: () => adminApi.order(id), enabled: Boolean(id) });
  const order = query.data?.data;
  if (query.isLoading) return <Skeleton className="h-40" />;
  if (!order) {
    return <EmptyState title="Order not found" body="This order may have been removed." />;
  }
  const address = order.shippingAddress;
  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={order.orderNumber}
        action={<AdminBackLink fallback="/admin/orders" />}
      />
      <div className="rounded-2xl bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge>{ADMIN_ORDER_STATUS_LABEL[order.orderStatus] || order.orderStatus.replace(/_/g, " ")}</Badge>
          <p className="font-display text-xl">{formatCad(order.total)}</p>
        </div>
        <p className="mt-2 text-sm text-yd-muted">
          Payment {order.paymentMethod} · {order.paymentStatus}
        </p>
        {order.createdAt ? <p className="text-sm text-yd-muted">{new Date(order.createdAt).toLocaleString("en-CA")}</p> : null}
        {order.orderStatus === "cancelled" && order.cancelledAt ? (
          <p className="mt-1 text-sm text-yd-muted">
            Cancelled {new Date(order.cancelledAt).toLocaleString("en-CA")}
          </p>
        ) : null}
      </div>
      {order.orderStatus === "cancelled" && order.cancellationReason ? (
        <section className="rounded-2xl border border-yd-border bg-white p-4 shadow-soft">
          <h2 className="font-display text-lg text-yd-forest">Cancellation feedback</h2>
          <p className="mt-2 text-sm text-yd-ink">
            Reason: {ADMIN_CANCEL_REASON_LABEL[order.cancellationReason] || order.cancellationReason}
          </p>
          {order.cancellationBetterDealDetails ? (
            <p className="mt-1 text-sm text-yd-muted">
              Better deal details: {order.cancellationBetterDealDetails}
            </p>
          ) : null}
          {order.cancellationFeedbackAt ? (
            <p className="mt-2 text-xs text-yd-muted">
              Submitted {new Date(order.cancellationFeedbackAt).toLocaleString("en-CA")}
            </p>
          ) : null}
        </section>
      ) : order.orderStatus === "cancelled" ? (
        <section className="rounded-2xl border border-dashed border-yd-border bg-yd-cream/40 p-4 text-sm text-yd-muted">
          No cancellation feedback was provided.
        </section>
      ) : null}
      <AdminOrderFulfillment
        orderId={entityId(order)}
        orderStatus={order.orderStatus}
        trackingNumber={order.trackingNumber}
        trackingUrl={order.trackingUrl}
        onUpdated={async () => {
          await queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
          await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
        }}
      />
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
  const queryClient = useQueryClient();
  const toast = useToastStore((s) => s.push);
  const query = useQuery({ queryKey: ["admin-customers"], queryFn: () => adminApi.customers() });

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await adminApi.setCustomerActive(id, isActive);
      toast(isActive ? "Customer enabled" : "Customer disabled");
      await queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not update customer", "error");
    }
  };

  return (
    <div>
      <PageHeader title="Customers" />
      {query.isLoading ? <Skeleton className="h-32" /> : null}
      {!query.isLoading && !(query.data?.items || []).length ? (
        <EmptyState title="No customers" body="Registered customers will appear here." />
      ) : null}
      {(query.data?.items || []).map((user) => (
        <article key={user.id} className="mb-2 flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-soft">
          <div className="min-w-0">
            <p className="font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-sm text-yd-muted">{user.email}</p>
            {user.phone ? <p className="text-xs text-yd-muted">{user.phone}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={user.isActive ? "sage" : "muted"}>{user.isActive ? "Active" : "Disabled"}</Badge>
            <Link to={`/admin/customers/${user.id}`}>
              <Button size="sm" variant="outline">
                Edit
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => toggleActive(user.id, !user.isActive)}>
              {user.isActive ? "Disable" : "Enable"}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

type CustomerFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
  isEmailVerified: boolean;
  addressId: string;
  fullName: string;
  addressPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark: string;
  addressType: "home" | "work" | "other";
};

const emptyCustomerForm: CustomerFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  isActive: true,
  isEmailVerified: false,
  addressId: "",
  fullName: "",
  addressPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "ON",
  postalCode: "",
  country: "Canada",
  landmark: "",
  addressType: "home",
};

export function AdminCustomerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useAdminBack("/admin/customers");
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm);

  const existing = useQuery({
    queryKey: ["admin-customer", id],
    queryFn: () => adminApi.customer(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    const user = existing.data?.data;
    if (!user) return;
    const addresses = user.addresses || [];
    const address = addresses.find((a) => a.isDefault) || addresses[0];
    setForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      isActive: user.isActive ?? true,
      isEmailVerified: user.isEmailVerified ?? false,
      addressId: address?.id || address?._id || "",
      fullName: address?.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      addressPhone: address?.phone || user.phone || "",
      addressLine1: address?.addressLine1 || "",
      addressLine2: address?.addressLine2 || "",
      city: address?.city || "",
      state: address?.state || "ON",
      postalCode: address?.postalCode || "",
      country: address?.country || "Canada",
      landmark: address?.landmark || "",
      addressType: address?.addressType || "home",
    });
  }, [existing.data]);

  const setField = <K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!id) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast("First name, last name, and email are required", "error");
      return;
    }
    setSaving(true);
    try {
      const hasAddress = Boolean(form.addressLine1.trim() && form.city.trim() && form.postalCode.trim());
      await adminApi.updateCustomer(id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        isActive: form.isActive,
        isEmailVerified: form.isEmailVerified,
        ...(hasAddress
          ? {
              defaultAddress: {
                ...(form.addressId ? { id: form.addressId } : {}),
                fullName: form.fullName.trim() || `${form.firstName} ${form.lastName}`.trim(),
                phone: form.addressPhone.trim() || form.phone.trim() || "0000000000",
                addressLine1: form.addressLine1.trim(),
                addressLine2: form.addressLine2.trim() || undefined,
                city: form.city.trim(),
                state: form.state.trim() || "ON",
                postalCode: form.postalCode.trim(),
                country: form.country.trim() || "Canada",
                landmark: form.landmark.trim() || undefined,
                addressType: form.addressType,
              },
            }
          : {}),
      });
      toast("Customer saved");
      await queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-customer", id] });
      navigate("/admin/customers");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save customer", "error");
    } finally {
      setSaving(false);
    }
  };

  if (existing.isLoading) return <Skeleton className="h-48" />;
  if (existing.isError || !existing.data?.data) {
    return (
      <div>
        <PageHeader title="Customer" />
        <EmptyState title="Customer not found" body="This customer may have been removed." />
        <Button className="mt-4" variant="outline" onClick={goBack}>
          Back to customers
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Edit customer"
        action={
          <Button variant="outline" onClick={goBack}>
            Back
          </Button>
        }
      />
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <p className="text-sm font-semibold">Profile</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="First name" value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} required />
          <Input label="Last name" value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} required />
        </div>
        <Input label="Email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} required />
        <Input label="Phone" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Status"
            value={form.isActive ? "active" : "disabled"}
            onChange={(e) => setField("isActive", e.target.value === "active")}
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
          <Select
            label="Email verified"
            value={form.isEmailVerified ? "yes" : "no"}
            onChange={(e) => setField("isEmailVerified", e.target.value === "yes")}
          >
            <option value="yes">Verified</option>
            <option value="no">Not verified</option>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <p className="text-sm font-semibold">Default address</p>
        <p className="text-xs text-yd-muted">Leave blank to keep existing addresses unchanged.</p>
        <Input label="Full name" value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} />
        <Input label="Phone" value={form.addressPhone} onChange={(e) => setField("addressPhone", e.target.value)} />
        <Input label="Address line 1" value={form.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)} />
        <Input label="Address line 2" value={form.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="City" value={form.city} onChange={(e) => setField("city", e.target.value)} />
          <Input label="Province / State" value={form.state} onChange={(e) => setField("state", e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Postal code" value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)} />
          <Input label="Country" value={form.country} onChange={(e) => setField("country", e.target.value)} />
        </div>
        <Input label="Landmark" value={form.landmark} onChange={(e) => setField("landmark", e.target.value)} />
        <Select
          label="Address type"
          value={form.addressType}
          onChange={(e) => setField("addressType", e.target.value as CustomerFormState["addressType"])}
        >
          <option value="home">Home</option>
          <option value="work">Work</option>
          <option value="other">Other</option>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="outline" onClick={goBack}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function toDatetimeLocalValue(value?: string | Date) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Fixed discounts may be stored as cents or legacy dollars (< 100 with a min order). */
function fixedDiscountCents(coupon: Coupon) {
  const value = Number(coupon.discountValue) || 0;
  if (value > 0 && value < 100 && (coupon.minimumOrderValue || coupon.minimumOrderValueCents)) {
    return Math.round(value * 100);
  }
  return Math.round(value);
}

function formatCouponDiscount(coupon: Coupon) {
  if (coupon.discountType === "percentage") return `${coupon.discountValue}% off`;
  return `${formatCadFromCents(fixedDiscountCents(coupon))} off`;
}

export function AdminCouponsPage() {
  const query = useQuery({ queryKey: ["admin-coupons"], queryFn: () => adminApi.coupons() });
  const toast = useToastStore((s) => s.push);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const items = query.data || [];

  return (
    <div>
      <PageHeader
        title="Coupons"
        action={
          <Link to="/admin/coupons/new" className="text-sm font-semibold text-yd-green">
            Add coupon
          </Link>
        }
      />
      <p className="mb-4 text-sm text-yd-muted">
        Create and manage discount codes. Deactivating a coupon stops new redemptions without deleting history.
      </p>
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? (
        <EmptyState title="No coupons" body="Create a coupon code for checkout discounts." />
      ) : null}
      <div className="space-y-3">
        {items.map((coupon) => {
          const id = entityId(coupon);
          return (
            <article
              key={id || coupon.couponCode}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-yd-border/60 bg-white p-4 shadow-soft"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold tracking-wide text-charcoal-900">{coupon.couponCode}</p>
                  <Badge tone={coupon.isActive ? "sage" : "muted"}>{coupon.isActive ? "Active" : "Inactive"}</Badge>
                </div>
                <p className="text-sm text-yd-muted">
                  {formatCouponDiscount(coupon)}
                  {(coupon.minimumOrderValueCents ?? Math.round((coupon.minimumOrderValue || 0) * 100)) > 0
                    ? ` · min ${formatCadFromCents(coupon.minimumOrderValueCents ?? Math.round((coupon.minimumOrderValue || 0) * 100))}`
                    : ""}
                  {coupon.usageLimit ? ` · used ${coupon.usedCount}/${coupon.usageLimit}` : ` · used ${coupon.usedCount}`}
                </p>
                <p className="text-xs text-yd-muted">
                  {new Date(coupon.startDate).toLocaleString()} → {new Date(coupon.endDate).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  to={`/admin/coupons/${id}`}
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-yd-border bg-white px-4 text-sm font-semibold text-yd-forest hover:bg-yd-cream"
                >
                  Edit
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!coupon.isActive}
                  onClick={() => setDeleteId(id)}
                >
                  Deactivate
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Deactivate coupon"
        body="This coupon will stop working at checkout. You can reactivate it later from the edit screen."
        confirmLabel="Deactivate"
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await adminApi.deleteCoupon(deleteId);
            toast("Coupon deactivated");
            setDeleteId(null);
            await query.refetch();
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not deactivate coupon", "error");
          }
        }}
      />
    </div>
  );
}

type CouponFormState = {
  couponCode: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minimumOrderValue: string;
  maximumDiscount: string;
  startDate: string;
  endDate: string;
  usageLimit: string;
  perUserLimit: string;
  isActive: boolean;
};

const emptyCouponForm = (): CouponFormState => ({
  couponCode: "",
  discountType: "percentage",
  discountValue: "",
  minimumOrderValue: "",
  maximumDiscount: "",
  startDate: "",
  endDate: "",
  usageLimit: "",
  perUserLimit: "1",
  isActive: true,
});

export function AdminCouponFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const goBack = useAdminBack("/admin/coupons");
  const toast = useToastStore((s) => s.push);
  const coupons = useQuery({ queryKey: ["admin-coupons"], queryFn: () => adminApi.coupons() });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<CouponFormState>(emptyCouponForm);

  useEffect(() => {
    if (isNew) return;
    const coupon = (coupons.data || []).find((item) => entityId(item) === id);
    if (!coupon) return;
    const minCents =
      typeof coupon.minimumOrderValueCents === "number"
        ? coupon.minimumOrderValueCents
        : Math.round((coupon.minimumOrderValue || 0) * 100);
    const maxCents =
      typeof coupon.maximumDiscountCents === "number"
        ? coupon.maximumDiscountCents
        : coupon.maximumDiscount != null
          ? Math.round(coupon.maximumDiscount * 100)
          : undefined;
    const fixedCad =
      coupon.discountType === "fixed" ? (fixedDiscountCents(coupon) / 100).toFixed(2).replace(/\.00$/, "") : "";
    setForm({
      couponCode: coupon.couponCode || "",
      discountType: coupon.discountType || "percentage",
      discountValue: coupon.discountType === "percentage" ? String(coupon.discountValue ?? "") : fixedCad,
      minimumOrderValue: minCents ? String((minCents / 100).toFixed(2)).replace(/\.00$/, "") : "",
      maximumDiscount: maxCents != null ? String((maxCents / 100).toFixed(2)).replace(/\.00$/, "") : "",
      startDate: toDatetimeLocalValue(coupon.startDate),
      endDate: toDatetimeLocalValue(coupon.endDate),
      usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : "",
      perUserLimit: String(coupon.perUserLimit ?? 1),
      isActive: coupon.isActive !== false,
    });
  }, [coupons.data, id, isNew]);

  const save = async () => {
    setSaving(true);
    try {
      const discountValueNum = Number(form.discountValue);
      const minOrderDollars = Number(form.minimumOrderValue || 0);
      const maxDiscountDollars = form.maximumDiscount.trim() ? Number(form.maximumDiscount) : undefined;
      const payload: Record<string, unknown> = {
        couponCode: form.couponCode.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue:
          form.discountType === "percentage" ? discountValueNum : Math.round(discountValueNum * 100),
        minimumOrderValue: minOrderDollars,
        startDate: form.startDate,
        endDate: form.endDate,
        perUserLimit: Math.max(1, Number(form.perUserLimit) || 1),
        isActive: form.isActive,
      };
      if (maxDiscountDollars != null && Number.isFinite(maxDiscountDollars)) {
        payload.maximumDiscount = maxDiscountDollars;
      }
      if (form.usageLimit.trim()) {
        payload.usageLimit = Math.max(1, Number(form.usageLimit) || 1);
      }
      if (isNew) {
        await adminApi.createCoupon(payload);
        toast("Coupon created");
      } else {
        await adminApi.updateCoupon(id!, payload);
        toast("Coupon saved");
      }
      await coupons.refetch();
      navigate("/admin/coupons");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save coupon", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && coupons.isLoading) return <Skeleton className="h-40" />;
  if (!isNew && !coupons.isLoading && !(coupons.data || []).some((item) => entityId(item) === id)) {
    return <EmptyState title="Coupon not found" body="It may have been removed." />;
  }

  return (
    <div className="w-full space-y-4 pb-24">
      <PageHeader
        title={isNew ? "Add coupon" : form.couponCode || "Edit coupon"}
        action={<AdminBackLink fallback="/admin/coupons" />}
      />
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <Input
          label="Code"
          value={form.couponCode}
          onChange={(e) => setForm((p) => ({ ...p, couponCode: e.target.value.toUpperCase() }))}
          required
        />
        <Select
          label="Type"
          value={form.discountType}
          onChange={(e) =>
            setForm((p) => ({ ...p, discountType: e.target.value as "percentage" | "fixed" }))
          }
        >
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed amount (CAD)</option>
        </Select>
        <Input
          label={form.discountType === "percentage" ? "Percent off" : "Amount off (CAD)"}
          type="number"
          step="0.01"
          min="0"
          value={form.discountValue}
          onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
          required
        />
        <Input
          label="Minimum order (CAD)"
          type="number"
          step="0.01"
          min="0"
          value={form.minimumOrderValue}
          onChange={(e) => setForm((p) => ({ ...p, minimumOrderValue: e.target.value }))}
        />
        <Input
          label="Max discount (CAD, optional)"
          type="number"
          step="0.01"
          min="0"
          value={form.maximumDiscount}
          onChange={(e) => setForm((p) => ({ ...p, maximumDiscount: e.target.value }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Starts"
            type="datetime-local"
            value={form.startDate}
            onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
            required
          />
          <Input
            label="Ends"
            type="datetime-local"
            value={form.endDate}
            onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Usage limit (optional)"
            type="number"
            min="1"
            value={form.usageLimit}
            onChange={(e) => setForm((p) => ({ ...p, usageLimit: e.target.value }))}
          />
          <Input
            label="Per-user limit"
            type="number"
            min="1"
            value={form.perUserLimit}
            onChange={(e) => setForm((p) => ({ ...p, perUserLimit: e.target.value }))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
          />{" "}
          Active
        </label>
      </div>
      <div className="flex gap-2">
        {!isNew ? (
          <Button variant="danger" disabled={saving || !form.isActive} onClick={() => setConfirmDelete(true)}>
            Deactivate
          </Button>
        ) : null}
        <Button variant="outline" disabled={saving} onClick={goBack}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={
            saving ||
            !form.couponCode.trim() ||
            !form.discountValue ||
            !form.startDate ||
            !form.endDate
          }
          onClick={() => void save()}
        >
          {saving ? "Saving…" : isNew ? "Create coupon" : "Save changes"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Deactivate coupon"
        body="This coupon will stop working at checkout. You can reactivate it later by turning Active back on."
        confirmLabel="Deactivate"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await adminApi.deleteCoupon(id!);
            toast("Coupon deactivated");
            navigate("/admin/coupons");
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not deactivate coupon", "error");
          }
        }}
      />
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

const SAME_DAY_WEEKDAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings"], queryFn: () => adminApi.settings() });
  const toast = useToastStore((s) => s.push);
  const settings = (query.data?.data || {}) as Record<string, unknown>;
  const defaultWeekdays = Array.isArray(settings.sameDayWeekdays)
    ? (settings.sameDayWeekdays as number[])
    : [1, 2, 3, 4, 5, 6];
  if (query.isLoading) return <Skeleton className="h-40" />;
  return (
    <form
      className="w-full space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const weekdays = SAME_DAY_WEEKDAY_OPTIONS.map((d) => d.value).filter((value) =>
          form.getAll("sameDayWeekdays").includes(String(value)),
        );
        const prefixes = String(form.get("sameDayPostalPrefixes") || "")
          .split(/[\s,]+/)
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean);
        await adminApi.updateSettings({
          siteName: String(form.get("siteName")),
          currency: String(form.get("currency")),
          deliveryFeeCents: Number(form.get("deliveryFeeCents")),
          freeShippingThresholdCents: Number(form.get("freeShippingThresholdCents")),
          platformFeeCents: Number(form.get("platformFeeCents")),
          handlingFeeCents: Number(form.get("handlingFeeCents")),
          smallCartFeeCents: Number(form.get("smallCartFeeCents")),
          smallCartThresholdCents: Number(form.get("smallCartThresholdCents")),
          lowStockDisplayThreshold: Number(form.get("lowStockDisplayThreshold")),
          inStockDisplayThreshold: Number(form.get("inStockDisplayThreshold")),
          supportEmail: String(form.get("supportEmail")),
          sameDayDeliveryEnabled: form.get("sameDayDeliveryEnabled") === "on",
          sameDayCutoffTime: String(form.get("sameDayCutoffTime") || "16:00"),
          sameDayTimezone: String(form.get("sameDayTimezone") || "America/Edmonton"),
          sameDayWeekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5, 6],
          sameDayPostalPrefixes: prefixes,
        });
        toast("Settings saved");
        await query.refetch();
        await queryClient.invalidateQueries({ queryKey: ["public-settings"] });
      }}
    >
      <PageHeader title="Settings" />
      <p className="text-sm text-yd-muted">
        Fees are stored in minor units (cents). Currency controls storefront display formatting. Sales tax is configured under{" "}
        <Link to="/admin/tax-rates" className="font-semibold text-yd-green">
          Provincial taxes
        </Link>
        , using the delivery address province at checkout.
      </p>
      <Input label="Site name" name="siteName" defaultValue={String(settings.siteName || "")} />
      <Select label="Currency" name="currency" defaultValue={String(settings.currency || "CAD")}>
        {["CAD", "USD", "INR", "GBP", "EUR", "AUD"].map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </Select>
      <Input label="Default delivery fee (cents)" name="deliveryFeeCents" type="number" defaultValue={String(settings.deliveryFeeCents ?? 499)} />
      <p className="-mt-1 text-xs text-yd-muted">
        Fallback when no delivery area matches. Per-area standard and Superfast fees are set under{" "}
        <Link to="/admin/delivery-locations" className="font-semibold text-yd-green">
          Delivery areas
        </Link>
        .
      </p>
      <Input label="Free shipping threshold (cents)" name="freeShippingThresholdCents" type="number" defaultValue={String(settings.freeShippingThresholdCents ?? 7500)} />
      <Input label="Platform fee (cents)" name="platformFeeCents" type="number" defaultValue={String(settings.platformFeeCents ?? 99)} />
      <Input label="Handling fee (cents)" name="handlingFeeCents" type="number" defaultValue={String(settings.handlingFeeCents ?? 49)} />
      <Input label="Small cart fee (cents)" name="smallCartFeeCents" type="number" defaultValue={String(settings.smallCartFeeCents ?? 199)} />
      <Input label="Small cart threshold (cents)" name="smallCartThresholdCents" type="number" defaultValue={String(settings.smallCartThresholdCents ?? 2500)} />
      <Input label="Support email" name="supportEmail" defaultValue={String(settings.supportEmail || "")} />

      <div className="space-y-3 rounded-2xl border border-yd-border bg-white p-4 shadow-soft">
        <h2 className="font-display text-lg text-yd-forest">Product stock labels</h2>
        <p className="text-xs text-yd-muted">
          Controls the product detail page when Unlimited quantity is off. Stock 0 is always red
          &quot;Currently Out of stock&quot;. At or below the low threshold shows yellow &quot;N available&quot;.
          Above the in-stock threshold shows green &quot;In stock&quot;.
        </p>
        <Input
          label="Low stock threshold (yellow)"
          name="lowStockDisplayThreshold"
          type="number"
          min={0}
          defaultValue={String(settings.lowStockDisplayThreshold ?? 5)}
        />
        <Input
          label='In stock threshold (green "In stock" above this)'
          name="inStockDisplayThreshold"
          type="number"
          min={0}
          defaultValue={String(settings.inStockDisplayThreshold ?? 10)}
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-yd-border bg-white p-4 shadow-soft">
        <h2 className="font-display text-lg text-yd-forest">Same-day delivery cutoff</h2>
        <p className="text-xs text-yd-muted">
          Shows a countdown on the homepage, product pages, cart, and checkout. Separate from Superfast Delivery
          (paid surcharge) — this is the order-by time for same-day vs next-day promises.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium text-yd-ink">
          <input
            type="checkbox"
            name="sameDayDeliveryEnabled"
            defaultChecked={settings.sameDayDeliveryEnabled !== false}
            className="accent-yd-green"
          />
          Enable same-day delivery timer
        </label>
        <Input
          label="Cutoff time (24h HH:mm)"
          name="sameDayCutoffTime"
          defaultValue={String(settings.sameDayCutoffTime || "16:00")}
          placeholder="16:00"
        />
        <Select
          label="Timezone"
          name="sameDayTimezone"
          defaultValue={String(settings.sameDayTimezone || "America/Edmonton")}
        >
          {[
            { value: "America/St_Johns", label: "Newfoundland (St. John’s)" },
            { value: "America/Halifax", label: "Atlantic (Halifax)" },
            { value: "America/Glace_Bay", label: "Atlantic (Cape Breton)" },
            { value: "America/Moncton", label: "Atlantic (Moncton)" },
            { value: "America/Goose_Bay", label: "Atlantic (Happy Valley–Goose Bay)" },
            { value: "America/Blanc-Sablon", label: "Atlantic — no DST (Blanc-Sablon, QC)" },
            { value: "America/Toronto", label: "Eastern (Toronto / Ottawa)" },
            { value: "America/Iqaluit", label: "Eastern (Iqaluit)" },
            { value: "America/Nipigon", label: "Eastern (Nipigon, ON)" },
            { value: "America/Thunder_Bay", label: "Eastern (Thunder Bay)" },
            { value: "America/Pangnirtung", label: "Eastern (Pangnirtung)" },
            { value: "America/Winnipeg", label: "Central (Winnipeg)" },
            { value: "America/Rainy_River", label: "Central (Rainy River)" },
            { value: "America/Resolute", label: "Central (Resolute)" },
            { value: "America/Rankin_Inlet", label: "Central (Rankin Inlet)" },
            { value: "America/Regina", label: "Central — no DST (Saskatchewan)" },
            { value: "America/Swift_Current", label: "Central — no DST (Swift Current)" },
            { value: "America/Edmonton", label: "Mountain (Edmonton / Calgary)" },
            { value: "America/Cambridge_Bay", label: "Mountain (Cambridge Bay)" },
            { value: "America/Yellowknife", label: "Mountain (Yellowknife)" },
            { value: "America/Inuvik", label: "Mountain (Inuvik)" },
            { value: "America/Creston", label: "Mountain — no DST (Creston, BC)" },
            { value: "America/Dawson_Creek", label: "Mountain — no DST (Dawson Creek)" },
            { value: "America/Fort_Nelson", label: "Mountain — no DST (Fort Nelson)" },
            { value: "America/Whitehorse", label: "Mountain — no DST (Whitehorse)" },
            { value: "America/Dawson", label: "Mountain — no DST (Dawson City)" },
            { value: "America/Vancouver", label: "Pacific (Vancouver)" },
          ].map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </Select>
        <div>
          <p className="mb-2 text-sm font-medium text-yd-ink">Applicable days</p>
          <div className="flex flex-wrap gap-2">
            {SAME_DAY_WEEKDAY_OPTIONS.map((day) => (
              <label
                key={day.value}
                className="inline-flex items-center gap-1.5 rounded-full border border-yd-border px-3 py-1.5 text-xs font-semibold"
              >
                <input
                  type="checkbox"
                  name="sameDayWeekdays"
                  value={day.value}
                  defaultChecked={defaultWeekdays.includes(day.value)}
                  className="accent-yd-green"
                />
                {day.label}
              </label>
            ))}
          </div>
        </div>
        <Input
          label="Applicable postal prefixes (optional)"
          name="sameDayPostalPrefixes"
          defaultValue={
            Array.isArray(settings.sameDayPostalPrefixes)
              ? (settings.sameDayPostalPrefixes as string[]).join(", ")
              : ""
          }
          placeholder="T2W, T2X, T3A"
        />
        <p className="-mt-1 text-xs text-yd-muted">Leave blank for all delivery areas. Use FSA prefixes like T2W.</p>
      </div>

      <Button>Save</Button>
    </form>
  );
}
