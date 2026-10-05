import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type AdminMerchandising } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Input";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { ConfirmDialog } from "../../components/ui/Overlay";
import { entityId, mediaUrl } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { formatCad } from "../../utils/money";

const PLACEMENTS = [
  { value: "home", label: "Home" },
  { value: "offers", label: "Offers" },
  { value: "gifts", label: "Gifts" },
] as const;

type SelectedProduct = {
  id: string;
  name: string;
  thumbnail?: string;
  price?: number;
};

export function AdminMerchandisingPage() {
  const query = useQuery({ queryKey: ["admin-merchandising"], queryFn: () => adminApi.merchandising() });
  const toast = useToastStore((s) => s.push);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const items = query.data?.data || [];

  return (
    <div>
      <PageHeader
        title="Merchandising"
        action={
          <Link to="/admin/merchandising/new" className="text-sm font-semibold text-yd-green">
            New collection
          </Link>
        }
      />
      <p className="mb-4 text-sm text-yd-muted">
        Create named rails for Home, Offers, and Gifts, then pick the products that appear in each.
      </p>
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? (
        <EmptyState title="No merchandising yet" body="Add a collection to curate products on the storefront." />
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const id = entityId(item);
          return (
            <article key={id} className="relative overflow-hidden rounded-2xl border border-yd-border/60 bg-white shadow-soft">
              <Link to={`/admin/merchandising/${id}`} className="block">
                {item.image ? (
                  <img src={mediaUrl(item.image)} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-yd-cream text-xs text-yd-muted">No image</div>
                )}
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold">{item.name}</p>
                  <p className="text-xs capitalize text-yd-muted">
                    {item.placement} · {item.productCount ?? item.productIds?.length ?? 0} products
                  </p>
                  <Badge tone={item.isActive ? "sage" : "muted"}>{item.isActive ? "Active" : "Inactive"}</Badge>
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
        title="Delete merchandising"
        body="This collection will be removed from the storefront. Products themselves are not deleted."
        confirmLabel="Delete"
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await adminApi.deleteMerchandising(deleteId);
            toast("Collection deleted");
            setDeleteId(null);
            await query.refetch();
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not delete", "error");
          }
        }}
      />
    </div>
  );
}

export function AdminMerchandisingFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.push);
  const existing = useQuery({
    queryKey: ["admin-merchandising", id],
    queryFn: () => adminApi.merchandisingItem(id!),
    enabled: !isNew,
  });

  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    subtitle: "",
    placement: "home" as AdminMerchandising["placement"],
    image: "",
    sortOrder: 0,
    isActive: true,
  });
  const [selected, setSelected] = useState<SelectedProduct[]>([]);

  const productSearch = useQuery({
    queryKey: ["admin-products-search", search],
    queryFn: () => adminApi.products({ search, limit: 12 }),
    enabled: search.trim().length >= 2,
  });

  useEffect(() => {
    const data = existing.data?.data;
    if (!data) return;
    setForm({
      name: data.name || "",
      subtitle: data.subtitle || "",
      placement: data.placement || "home",
      image: data.image || "",
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive !== false,
    });
    setSelected(
      (data.products || []).map((p) => ({
        id: p.id,
        name: p.name,
        thumbnail: p.thumbnail,
        price: p.price,
      })),
    );
  }, [existing.data]);

  const addProduct = (product: { id?: string; _id?: string; name: string; thumbnail?: string; price?: number }) => {
    const pid = entityId(product);
    if (!pid || selected.some((item) => item.id === pid)) return;
    setSelected((prev) => [...prev, { id: pid, name: product.name, thumbnail: product.thumbnail, price: product.price }]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        subtitle: form.subtitle || undefined,
        placement: form.placement,
        image: form.image || undefined,
        sortOrder: Number(form.sortOrder),
        isActive: form.isActive,
        productIds: selected.map((item) => item.id),
      };
      if (isNew) {
        const created = await adminApi.createMerchandising(payload);
        toast("Collection created");
        navigate(`/admin/merchandising/${entityId(created.data)}`);
      } else {
        await adminApi.updateMerchandising(id!, payload);
        toast("Collection saved");
      }
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save collection", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && existing.isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-28">
      <PageHeader
        title={isNew ? "New merchandising" : "Edit merchandising"}
        action={
          <Link to="/admin/merchandising" className="text-sm font-semibold text-yd-muted">
            Back
          </Link>
        }
      />
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Diwali sweets" />
        <Textarea
          label="Subtitle"
          value={form.subtitle}
          onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
          rows={2}
        />
        <Select
          label="Placement"
          value={form.placement}
          onChange={(e) => setForm((p) => ({ ...p, placement: e.target.value as AdminMerchandising["placement"] }))}
        >
          {PLACEMENTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <Input label="Image URL" value={form.image} onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))} />
        <Input
          label="Sort order"
          type="number"
          value={form.sortOrder}
          onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />{" "}
          Active on storefront
        </label>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <h2 className="font-display text-lg">Products</h2>
        <Input
          label="Search catalog"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type at least 2 characters"
        />
        {productSearch.data?.items?.length ? (
          <div className="space-y-2">
            {productSearch.data.items.map((product) => (
              <button
                key={entityId(product)}
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-yd-border px-3 py-2 text-left text-sm"
                onClick={() => addProduct(product)}
              >
                <span className="truncate">{product.name}</span>
                <span className="shrink-0 text-xs font-semibold text-yd-green">Add</span>
              </button>
            ))}
          </div>
        ) : null}
        {!selected.length ? <p className="text-sm text-yd-muted">No products in this collection yet.</p> : null}
        <div className="space-y-2">
          {selected.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl bg-yd-cream/60 p-2">
              {item.thumbnail ? (
                <img src={mediaUrl(item.thumbnail)} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-yd-cream" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                {item.price != null ? <p className="text-xs text-yd-muted">{formatCad(item.price)}</p> : null}
              </div>
              <button type="button" className="text-xs font-semibold text-yd-error" onClick={() => setSelected((prev) => prev.filter((p) => p.id !== item.id))}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 border-t border-yd-border bg-white p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button variant="outline" disabled={saving} onClick={() => navigate("/admin/merchandising")}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={saving || !form.name.trim()} onClick={() => void save()}>
            {saving ? "Saving…" : isNew ? "Create collection" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
