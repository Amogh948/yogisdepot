import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type AdminBrand } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Input";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { ConfirmDialog } from "../../components/ui/Overlay";
import { entityId, mediaUrl } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";

export function AdminBrandsPage() {
  const query = useQuery({ queryKey: ["admin-brands"], queryFn: () => adminApi.brands() });
  const toast = useToastStore((s) => s.push);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const items = (query.data?.data || []) as AdminBrand[];

  return (
    <div>
      <PageHeader
        title="Brands"
        action={
          <Link to="/admin/brands/new" className="text-sm font-semibold text-yd-green">
            Add brand
          </Link>
        }
      />
      <p className="mb-4 text-sm text-yd-muted">Manage brand records, then map products to a brand from the product editor.</p>
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? <EmptyState title="No brands" body="Create a brand to organize products." /> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((brand) => {
          const id = entityId(brand);
          return (
            <article key={id} className="relative overflow-hidden rounded-2xl border border-yd-border/60 bg-white shadow-soft">
              <Link to={`/admin/brands/${id}`} className="block">
                {brand.logoUrl ? (
                  <img src={mediaUrl(brand.logoUrl)} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-yd-cream text-xs text-yd-muted">No logo</div>
                )}
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold">{brand.name}</p>
                  <p className="truncate text-xs text-yd-muted">{brand.slug}</p>
                  <Badge tone={brand.isActive ? "sage" : "muted"}>{brand.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </Link>
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-yd-error shadow-soft"
                onClick={(event) => {
                  event.preventDefault();
                  setDeleteId(id);
                }}
              >
                Delete
              </button>
            </article>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete brand"
        body="Brands with linked products cannot be deleted until those products are reassigned."
        confirmLabel="Delete"
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await adminApi.deleteBrand(deleteId);
            toast("Brand deleted");
            setDeleteId(null);
            await query.refetch();
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not delete brand", "error");
          }
        }}
      />
    </div>
  );
}

export function AdminBrandFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.push);
  const brands = useQuery({ queryKey: ["admin-brands"], queryFn: () => adminApi.brands() });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    <div className="mx-auto max-w-lg space-y-4 pb-24">
      <PageHeader
        title={isNew ? "Add brand" : form.name || "Edit brand"}
        action={
          <Link to="/admin/brands" className="text-sm font-semibold text-yd-muted">
            Back
          </Link>
        }
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
        <Button variant="outline" disabled={saving} onClick={() => navigate("/admin/brands")}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={saving || !form.name.trim()} onClick={() => void save()}>
          {saving ? "Saving…" : isNew ? "Create brand" : "Save changes"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete brand"
        body="Brands with linked products cannot be deleted until those products are reassigned."
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await adminApi.deleteBrand(id!);
            toast("Brand deleted");
            navigate("/admin/brands");
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not delete brand", "error");
          }
        }}
      />
    </div>
  );
}
