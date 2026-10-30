import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminBrand, type BrandBulkMode } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Input";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { Modal } from "../../components/ui/Overlay";
import { entityId, mediaUrl } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { AdminBackLink } from "../../components/admin/AdminBackLink";
import { useAdminBack } from "../../hooks/useAdminBack";

function productTotal(brands: AdminBrand[], ids: string[]) {
  const selected = new Set(ids);
  return brands.reduce((sum, brand) => (selected.has(entityId(brand)) ? sum + (brand.productCount || 0) : sum), 0);
}

function BrandDeleteDialog({
  open,
  brandCount,
  productCount,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  brandCount: number;
  productCount: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: (mode: Extract<BrandBulkMode, "delete_brands" | "delete_brands_and_products">) => void;
}) {
  const [withProducts, setWithProducts] = useState(false);
  const [brandOnly, setBrandOnly] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWithProducts(false);
    setBrandOnly(false);
  }, [open]);

  const brandLabel = brandCount === 1 ? "this brand" : `${brandCount} brands`;
  const productLabel = productCount === 1 ? "1 product" : `${productCount} products`;

  return (
    <Modal open={open} title="Delete brands" onClose={onClose}>
      <p className="text-sm text-yd-muted">
        Choose what to remove for {brandLabel}. They currently have {productLabel}.
      </p>
      <div className="mt-4 space-y-2">
        <label className="flex cursor-pointer gap-3 rounded-xl border border-yd-border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 accent-yd-green"
            checked={withProducts}
            onChange={(event) => {
              setWithProducts(event.target.checked);
              if (event.target.checked) setBrandOnly(false);
            }}
          />
          <span>
            <span className="block font-semibold text-yd-ink">Delete with the products</span>
            <span className="mt-0.5 block text-yd-muted">Removes the brand and every product assigned to it.</span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-xl border border-yd-border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 accent-yd-green"
            checked={brandOnly}
            onChange={(event) => {
              setBrandOnly(event.target.checked);
              if (event.target.checked) setWithProducts(false);
            }}
          />
          <span>
            <span className="block font-semibold text-yd-ink">Delete just the brand</span>
            <span className="mt-0.5 block text-yd-muted">
              Products stay in the catalog and are no longer assigned to the brand.
            </span>
          </span>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" type="button" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          type="button"
          disabled={pending || (!withProducts && !brandOnly)}
          loading={pending}
          onClick={() => onConfirm(withProducts ? "delete_brands_and_products" : "delete_brands")}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
}

export function AdminBrandsPage() {
  const query = useQuery({ queryKey: ["admin-brands"], queryFn: () => adminApi.brands() });
  const queryClient = useQueryClient();
  const toast = useToastStore((s) => s.push);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [productPrompt, setProductPrompt] = useState(false);
  const [brandPromptIds, setBrandPromptIds] = useState<string[] | null>(null);
  const items = (query.data?.data || []) as AdminBrand[];
  const allSelected = items.length > 0 && selected.length === items.length;

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const runBulk = async (ids: string[], mode: BrandBulkMode) => {
    setPending(true);
    try {
      const result = await adminApi.bulkBrands({ brandIds: ids, mode });
      const data = result.data;
      if (mode === "delete_products") {
        toast(`Deleted ${data.deletedProducts} product${data.deletedProducts === 1 ? "" : "s"}`);
      } else if (mode === "delete_brands") {
        toast(`Deleted ${data.deletedBrands} brand${data.deletedBrands === 1 ? "" : "s"} and kept the products`);
      } else {
        toast(`Deleted ${data.deletedBrands} brand${data.deletedBrands === 1 ? "" : "s"} and ${data.deletedProducts} product${data.deletedProducts === 1 ? "" : "s"}`);
      }
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      setProductPrompt(false);
      setBrandPromptIds(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not update brands", "error");
      await query.refetch();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="pb-24">
      <PageHeader
        title="Brands"
        action={
          <Link to="/admin/brands/new" className="text-sm font-semibold text-yd-green">
            Add brand
          </Link>
        }
      />
      <p className="mb-4 text-sm text-yd-muted">
        Select brands to delete their products, or to delete the brands with or without those products.
      </p>
      {items.length ? (
        <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-yd-ink">
          <input
            type="checkbox"
            className="accent-yd-green"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? [] : items.map((brand) => entityId(brand)))}
          />
          Select all
        </label>
      ) : null}
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? <EmptyState title="No brands" body="Create a brand to organize products." /> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((brand) => {
          const id = entityId(brand);
          const checked = selected.includes(id);
          return (
            <article
              key={id}
              className={`relative overflow-hidden rounded-2xl border bg-white shadow-soft ${checked ? "border-yd-green" : "border-yd-border/60"}`}
            >
              <label className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-soft">
                <input
                  type="checkbox"
                  className="accent-yd-green"
                  checked={checked}
                  aria-label={`Select ${brand.name}`}
                  onChange={() => toggle(id)}
                />
              </label>
              <Link to={`/admin/brands/${id}`} className="block">
                {brand.logoUrl ? (
                  <img src={mediaUrl(brand.logoUrl)} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-yd-cream text-xs text-yd-muted">No logo</div>
                )}
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold">{brand.name}</p>
                  <p className="truncate text-xs text-yd-muted">{brand.slug}</p>
                  <p className="text-xs text-yd-muted">
                    {brand.productCount || 0} product{(brand.productCount || 0) === 1 ? "" : "s"}
                  </p>
                  <Badge tone={brand.isActive ? "sage" : "muted"}>{brand.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </Link>
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-yd-error shadow-soft"
                onClick={() => setBrandPromptIds([id])}
              >
                Delete
              </button>
            </article>
          );
        })}
      </div>
      {selected.length ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-yd-border bg-white/95 p-3 backdrop-blur sm:static sm:mt-4 sm:rounded-2xl sm:border sm:shadow-soft">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <p className="mr-auto text-sm font-semibold text-yd-ink">
              {selected.length} selected · {productTotal(items, selected)} products
            </p>
            <Button variant="outline" type="button" disabled={pending} onClick={() => setSelected([])}>
              Clear
            </Button>
            <Button variant="danger" type="button" disabled={pending} onClick={() => setProductPrompt(true)}>
              Delete products
            </Button>
            <Button variant="danger" type="button" disabled={pending} onClick={() => setBrandPromptIds(selected)}>
              Delete brands
            </Button>
          </div>
        </div>
      ) : null}
      <Modal open={productPrompt} title="Delete products" onClose={() => { if (!pending) setProductPrompt(false); }}>
        <p className="text-sm text-yd-muted">
          Delete all products assigned to {selected.length === 1 ? "the selected brand" : `${selected.length} selected brands`} (
          {productTotal(items, selected)} products). The brands stay in the catalog.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" type="button" disabled={pending} onClick={() => setProductPrompt(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            type="button"
            loading={pending}
            onClick={() => void runBulk(selected, "delete_products")}
          >
            Delete products
          </Button>
        </div>
      </Modal>
      <BrandDeleteDialog
        open={Boolean(brandPromptIds?.length)}
        brandCount={brandPromptIds?.length || 0}
        productCount={productTotal(items, brandPromptIds || [])}
        pending={pending}
        onClose={() => {
          if (!pending) setBrandPromptIds(null);
        }}
        onConfirm={(mode) => {
          if (!brandPromptIds?.length) return;
          void runBulk(brandPromptIds, mode);
        }}
      />
    </div>
  );
}

export function AdminBrandFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const goBack = useAdminBack("/admin/brands");
  const toast = useToastStore((s) => s.push);
  const brands = useQuery({ queryKey: ["admin-brands"], queryFn: () => adminApi.brands() });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", description: "", logoUrl: "", isActive: true });

  useEffect(() => {
    if (isNew) return;
    const brand = ((brands.data?.data || []) as AdminBrand[]).find((item) => entityId(item) === id);
    if (!brand) return;
    setForm({
      name: brand.name || "",
      description: brand.description || "",
      logoUrl: brand.logoUrl || "",
      isActive: brand.isActive !== false,
    });
  }, [brands.data, id, isNew]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        logoUrl: form.logoUrl || undefined,
        isActive: form.isActive,
      };
      if (isNew) {
        await adminApi.createBrand(payload);
        toast("Brand created");
        await brands.refetch();
        navigate("/admin/brands");
      } else {
        await adminApi.updateBrand(id!, payload);
        toast("Brand saved");
        await brands.refetch();
        navigate("/admin/brands");
      }
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save brand", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && brands.isLoading) return <Skeleton className="h-40" />;

  return (
    <div className="w-full space-y-4 pb-24">
      <PageHeader
        title={isNew ? "Add brand" : form.name || "Edit brand"}
        action={<AdminBackLink fallback="/admin/brands" />}
      />
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          rows={3}
        />
        <ImageUpload label="Brand logo" value={form.logoUrl} onChange={(url) => setForm((p) => ({ ...p, logoUrl: url }))} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} /> Active
        </label>
      </div>
      <div className="flex gap-2">
        {!isNew ? (
          <Button variant="danger" disabled={saving} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        ) : null}
        <Button variant="outline" disabled={saving} onClick={goBack}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={saving || !form.name.trim()} onClick={() => void save()}>
          {saving ? "Saving…" : isNew ? "Create brand" : "Save changes"}
        </Button>
      </div>
      <BrandDeleteDialog
        open={confirmDelete}
        brandCount={1}
        productCount={
          ((brands.data?.data || []) as AdminBrand[]).find((item) => entityId(item) === id)?.productCount || 0
        }
        pending={saving}
        onClose={() => {
          if (!saving) setConfirmDelete(false);
        }}
        onConfirm={async (mode) => {
          setSaving(true);
          try {
            await adminApi.bulkBrands({ brandIds: [id!], mode });
            toast(mode === "delete_brands" ? "Brand deleted. Products were kept." : "Brand and its products were deleted.");
            await queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
            await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
            navigate("/admin/brands");
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not delete brand", "error");
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
