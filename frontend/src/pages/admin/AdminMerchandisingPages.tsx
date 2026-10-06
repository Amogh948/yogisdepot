import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { adminApi, type AdminMerchandising } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Input";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { ConfirmDialog } from "../../components/ui/Overlay";
import { entityId, mediaUrl } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { formatCad } from "../../utils/money";
import { TASTE_INDIA_REGION_OPTIONS } from "../../content/discovery";

const PLACEMENTS = [
  { value: "home", label: "Home" },
  { value: "offers", label: "Offers" },
  { value: "gifts", label: "Gift hampers" },
  { value: "region", label: "Taste India (region)" },
  { value: "festival", label: "Festival store" },
] as const;

function regionSlugFromName(nameOrSlug: string) {
  const normalized = nameOrSlug.trim().toLowerCase();
  const exact = TASTE_INDIA_REGION_OPTIONS.find(
    (region) => region.name.toLowerCase() === normalized || region.slug === normalized,
  );
  if (exact) return exact.slug;
  const prefixed = TASTE_INDIA_REGION_OPTIONS.find(
    (region) => normalized === region.slug || normalized.startsWith(`${region.slug}-`),
  );
  return prefixed?.slug || "";
}

type SelectedProduct = {
  id: string;
  name: string;
  thumbnail?: string;
  price?: number;
};

function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function scheduleLabel(item: AdminMerchandising) {
  const start = item.startDate ? toDateInput(item.startDate) : "";
  const end = item.endDate ? toDateInput(item.endDate) : "";
  if (!start && !end) return "Always on";
  if (start && end) return `${start} → ${end}`;
  if (start) return `From ${start}`;
  return `Until ${end}`;
}

export function AdminMerchandisingPage({ placementFilter }: { placementFilter?: AdminMerchandising["placement"] } = {}) {
  const query = useQuery({ queryKey: ["admin-merchandising"], queryFn: () => adminApi.merchandising() });
  const toast = useToastStore((s) => s.push);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const allItems = query.data?.data || [];
  const items = placementFilter ? allItems.filter((item) => item.placement === placementFilter) : allItems;
  const isFestivals = placementFilter === "festival";
  const newHref = isFestivals ? "/admin/festivals/new" : "/admin/merchandising/new";
  const editBase = isFestivals ? "/admin/festivals" : "/admin/merchandising";

  return (
    <div>
      <PageHeader
        title={isFestivals ? "Festivals" : "Merchandising"}
        action={
          <Link to={newHref} className="text-sm font-semibold text-yd-green">
            {isFestivals ? "New festival" : "New collection"}
          </Link>
        }
      />
      <p className="mb-4 text-sm text-yd-muted">
        {isFestivals
          ? "Add festivals for the Festival Store, assign products, and they appear as festival cards on the storefront."
          : "Curate product rails for Home, Offers, Gift hampers, Taste India regions, and Festival store. Active Home, Offers, and Gift rails (within their start/end dates) appear above Bestsellers on the homepage. Optional dates control visibility."}
      </p>
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? (
        <EmptyState
          title={isFestivals ? "No festivals yet" : "No merchandising yet"}
          body={
            isFestivals
              ? "Create Diwali, Holi, Onam, and other festivals, then assign products."
              : "Add a collection to curate products on the storefront."
          }
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const id = entityId(item);
          return (
            <article key={id} className="relative overflow-hidden rounded-2xl border border-yd-border/60 bg-white shadow-soft">
              <Link to={`${editBase}/${id}`} className="block">
                {item.image ? (
                  <img src={mediaUrl(item.image)} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-yd-cream text-xs text-yd-muted">No image</div>
                )}
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold">{item.name}</p>
                  <p className="text-xs capitalize text-yd-muted">
                    {isFestivals ? "Festival" : item.placement} · {item.productCount ?? item.productIds?.length ?? 0} products
                  </p>
                  <p className="text-[11px] text-yd-muted">{scheduleLabel(item)}</p>
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
        title={isFestivals ? "Delete festival" : "Delete merchandising"}
        body={
          isFestivals
            ? "This festival will be removed from the Festival Store. Products themselves are not deleted."
            : "This collection will be removed from the storefront. Products themselves are not deleted."
        }
        confirmLabel="Delete"
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await adminApi.deleteMerchandising(deleteId);
            toast(isFestivals ? "Festival deleted" : "Collection deleted");
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

export function AdminFestivalsPage() {
  return <AdminMerchandisingPage placementFilter="festival" />;
}

export function AdminMerchandisingFormPage({
  lockedPlacement,
}: {
  lockedPlacement?: AdminMerchandising["placement"];
} = {}) {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const isFestival = lockedPlacement === "festival";
  const listPath = isFestival ? "/admin/festivals" : "/admin/merchandising";
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
    placement: (lockedPlacement || "home") as AdminMerchandising["placement"],
    regionSlug: "",
    image: "",
    sortOrder: 0,
    isActive: true,
    startDate: "",
    endDate: "",
  });
  const [selected, setSelected] = useState<SelectedProduct[]>([]);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const selectedListRef = useRef<HTMLDivElement>(null);

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
      placement: lockedPlacement || data.placement || "home",
      regionSlug:
        data.tasteIndiaRegion ||
        (data.placement === "region" ? regionSlugFromName(data.slug || data.name || "") : ""),
      image: data.image || "",
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive !== false,
      startDate: toDateInput(data.startDate),
      endDate: toDateInput(data.endDate),
    });
    setSelected(
      (data.products || []).map((p) => ({
        id: p.id,
        name: p.name,
        thumbnail: p.thumbnail,
        price: p.price,
      })),
    );
  }, [existing.data, lockedPlacement]);

  const addProduct = (product: { id?: string; _id?: string; name: string; thumbnail?: string; price?: number }) => {
    const pid = entityId(product);
    if (!pid) return;
    if (selected.some((item) => item.id === pid)) {
      toast("Already in this collection");
      selectedListRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    setSelected((prev) => [...prev, { id: pid, name: product.name, thumbnail: product.thumbnail, price: product.price }]);
    setJustAddedId(pid);
    toast(isFestival ? "Product added to festival" : "Product added to merchandising");
    window.setTimeout(() => {
      selectedListRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
    window.setTimeout(() => setJustAddedId((current) => (current === pid ? null : current)), 1600);
  };

  const save = async () => {
    if (form.placement === "region" && !form.regionSlug) {
      toast("Select a Taste India region", "error");
      return;
    }
    const region = TASTE_INDIA_REGION_OPTIONS.find((item) => item.slug === form.regionSlug);
    const name =
      form.placement === "region"
        ? form.name.trim() || region?.name || ""
        : form.name.trim();
    if (!name) {
      toast("Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        subtitle: form.subtitle || undefined,
        placement: lockedPlacement || form.placement,
        tasteIndiaRegion: form.placement === "region" ? form.regionSlug || null : null,
        image: form.image || undefined,
        sortOrder: Number(form.sortOrder),
        isActive: form.isActive,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        productIds: selected.map((item) => item.id),
      };
      if (isNew) {
        await adminApi.createMerchandising(payload);
        toast(isFestival ? "Festival created" : "Collection created");
        await queryClient.invalidateQueries({ queryKey: ["admin-merchandising"] });
        await queryClient.invalidateQueries({ queryKey: ["merchandising"] });
        navigate(listPath);
      } else {
        await adminApi.updateMerchandising(id!, payload);
        toast(isFestival ? "Festival saved" : "Collection saved");
        await queryClient.invalidateQueries({ queryKey: ["admin-merchandising"] });
        await queryClient.invalidateQueries({ queryKey: ["admin-merchandising", id] });
        await queryClient.invalidateQueries({ queryKey: ["merchandising"] });
        navigate(listPath);
      }
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && existing.isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-28">
      <PageHeader
        title={isNew ? (isFestival ? "New festival" : "New merchandising") : isFestival ? "Edit festival" : "Edit merchandising"}
        action={
          <Link to={listPath} className="text-sm font-semibold text-yd-muted">
            Back
          </Link>
        }
      />
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        {!isFestival ? (
          <Select
            label="Placement"
            value={form.placement}
            onChange={(e) => {
              const placement = e.target.value as AdminMerchandising["placement"];
              setForm((p) => ({
                ...p,
                placement,
                regionSlug: placement === "region" ? p.regionSlug : "",
              }));
            }}
          >
            {PLACEMENTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        ) : null}
        {form.placement === "region" && !isFestival ? (
          <Select
            label="Region"
            value={form.regionSlug}
            onChange={(e) => {
              const regionSlug = e.target.value;
              const region = TASTE_INDIA_REGION_OPTIONS.find((item) => item.slug === regionSlug);
              setForm((p) => ({
                ...p,
                regionSlug,
                name: region?.name || p.name,
              }));
            }}
            required
          >
            <option value="">Select region</option>
            {TASTE_INDIA_REGION_OPTIONS.map((region) => (
              <option key={region.slug} value={region.slug}>
                {region.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder={isFestival ? "Diwali" : form.placement === "region" ? "North India" : "Diwali sweets"}
        />
        <Textarea
          label="Subtitle"
          value={form.subtitle}
          onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
          rows={2}
          placeholder={isFestival ? "Sweets, snacks and gift boxes for the festival of lights" : undefined}
        />
        <ImageUpload
          label={isFestival ? "Festival image" : "Collection image"}
          value={form.image}
          onChange={(url) => setForm((p) => ({ ...p, image: url }))}
          hint="Used on Offers, Gifts, Taste India, and Festival cards"
        />
        <Input
          label="Sort order"
          type="number"
          value={form.sortOrder}
          onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Start date"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
            hint="Leave blank for no start limit"
          />
          <Input
            label="End date"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
            hint="Leave blank for no end limit"
          />
        </div>
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
            {productSearch.data.items.map((product) => {
              const pid = entityId(product);
              const added = selected.some((item) => item.id === pid);
              return (
                <button
                  key={pid}
                  type="button"
                  disabled={added}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                    added
                      ? "border-yd-green/30 bg-yd-green/5 text-yd-muted"
                      : "border-yd-border hover:border-yd-green/40"
                  }`}
                  onClick={() => addProduct(product)}
                >
                  <span className="truncate">{product.name}</span>
                  {added ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-yd-green">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Added
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs font-semibold text-yd-green">Add</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
        <div ref={selectedListRef} className="space-y-2">
          <p className="text-sm font-semibold text-yd-ink">
            In this collection{selected.length ? ` · ${selected.length}` : ""}
          </p>
          {!selected.length ? <p className="text-sm text-yd-muted">No products in this collection yet.</p> : null}
          {selected.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-xl p-2 transition ${
                justAddedId === item.id ? "bg-yd-green/15 ring-1 ring-yd-green/40" : "bg-yd-cream/60"
              }`}
            >
              {item.thumbnail ? (
                <img src={mediaUrl(item.thumbnail)} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-yd-cream" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                {item.price != null ? <p className="text-xs text-yd-muted">{formatCad(item.price)}</p> : null}
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-yd-error"
                onClick={() => setSelected((prev) => prev.filter((p) => p.id !== item.id))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 border-t border-yd-border bg-white p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button variant="outline" disabled={saving} onClick={() => navigate(listPath)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={
              saving ||
              (form.placement === "region"
                ? !form.regionSlug || !form.name.trim()
                : !form.name.trim())
            }
            onClick={() => void save()}
          >
            {saving
              ? "Saving…"
              : isNew
                ? isFestival
                  ? "Create festival"
                  : "Create collection"
                : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminFestivalFormPage() {
  return <AdminMerchandisingFormPage lockedPlacement="festival" />;
}
