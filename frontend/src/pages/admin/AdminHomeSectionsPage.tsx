import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { adminApi, type AdminHomeSection } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Input";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { entityId, mediaUrl } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { formatCad } from "../../utils/money";

const SECTION_LABELS: Record<AdminHomeSection["key"], string> = {
  bestsellers: "Bestsellers",
  deals: "Today's Deals",
  featured: "Featured Picks",
  new_arrivals: "New Arrivals",
};

type SelectedProduct = {
  id: string;
  name: string;
  thumbnail?: string;
  price?: number;
};

export function AdminHomeSectionsPage() {
  const query = useQuery({ queryKey: ["admin-home-sections"], queryFn: () => adminApi.homeSections() });
  const items = query.data?.data || [];

  return (
    <div>
      <PageHeader title="Home sections" />
      <p className="mb-4 text-sm text-yd-muted">
        Control the titles and products shown on the homepage for Bestsellers, Today&apos;s Deals, Featured Picks, and New
        Arrivals. Drag order is set with the up/down controls on each section&apos;s product list.
      </p>
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? (
        <EmptyState title="No home sections" body="Sections will appear once the catalog is ready." />
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const id = entityId(item);
          return (
            <Link
              key={id || item.key}
              to={`/admin/home-sections/${item.key}`}
              className="rounded-2xl border border-yd-border/60 bg-white p-4 shadow-soft transition hover:border-yd-green/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-yd-muted">
                    {SECTION_LABELS[item.key] || item.key}
                  </p>
                  <p className="truncate font-semibold text-yd-ink">{item.title}</p>
                  {item.subtitle ? <p className="line-clamp-2 text-sm text-yd-muted">{item.subtitle}</p> : null}
                  <p className="text-sm text-yd-muted">{item.productCount ?? item.productIds?.length ?? 0} products</p>
                </div>
                <Badge tone={item.isActive ? "sage" : "muted"}>{item.isActive ? "Active" : "Hidden"}</Badge>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function AdminHomeSectionFormPage() {
  const { keyOrId } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: ["admin-home-section", keyOrId],
    queryFn: () => adminApi.homeSection(keyOrId!),
    enabled: Boolean(keyOrId),
  });

  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    isActive: true,
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
      title: data.title || "",
      subtitle: data.subtitle || "",
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
    if (!pid) return;
    if (selected.some((item) => item.id === pid)) {
      toast("Already in this section");
      selectedListRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    setSelected((prev) => [...prev, { id: pid, name: product.name, thumbnail: product.thumbnail, price: product.price }]);
    setJustAddedId(pid);
    toast("Product added");
    window.setTimeout(() => {
      selectedListRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
    window.setTimeout(() => setJustAddedId((current) => (current === pid ? null : current)), 1600);
  };

  const moveProduct = (index: number, direction: -1 | 1) => {
    setSelected((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast("Title is required", "error");
      return;
    }
    if (!keyOrId) return;
    setSaving(true);
    try {
      await adminApi.updateHomeSection(keyOrId, {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        isActive: form.isActive,
        productIds: selected.map((item) => item.id),
      });
      toast("Home section saved");
      await queryClient.invalidateQueries({ queryKey: ["admin-home-sections"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-home-section", keyOrId] });
      await queryClient.invalidateQueries({ queryKey: ["home-sections"] });
      navigate("/admin/home-sections");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save section", "error");
    } finally {
      setSaving(false);
    }
  };

  if (existing.isLoading) return <Skeleton className="h-64" />;
  if (existing.isError || !existing.data?.data) {
    return (
      <EmptyState
        title="Section not found"
        body="This home section could not be loaded."
        action={
          <Link to="/admin/home-sections" className="text-sm font-semibold text-yd-green">
            Back
          </Link>
        }
      />
    );
  }

  const sectionKey = existing.data.data.key;
  const defaultLabel = SECTION_LABELS[sectionKey] || sectionKey;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-28">
      <PageHeader
        title={`Edit ${defaultLabel}`}
        action={
          <Link to="/admin/home-sections" className="text-sm font-semibold text-yd-muted">
            Back
          </Link>
        }
      />
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-yd-muted">Section key · {sectionKey}</p>
        <Input
          label="Section title"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder={defaultLabel}
          required
        />
        <Textarea
          label="Subtitle (optional)"
          value={form.subtitle}
          onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
          rows={2}
          placeholder="Short line under the title on the homepage"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
          />{" "}
          Show this section on the homepage
        </label>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <h2 className="font-display text-lg">Products</h2>
        <p className="text-sm text-yd-muted">Search the catalog, add products, then reorder with the arrows.</p>
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
            In this section{selected.length ? ` · ${selected.length}` : ""}
          </p>
          {!selected.length ? <p className="text-sm text-yd-muted">No products selected yet.</p> : null}
          {selected.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-xl p-2 transition ${
                justAddedId === item.id ? "bg-yd-green/15 ring-1 ring-yd-green/40" : "bg-yd-cream/60"
              }`}
            >
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-lg border border-yd-border bg-white text-yd-ink disabled:opacity-40"
                  onClick={() => moveProduct(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${item.name} up`}
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-lg border border-yd-border bg-white text-yd-ink disabled:opacity-40"
                  onClick={() => moveProduct(index, 1)}
                  disabled={index === selected.length - 1}
                  aria-label={`Move ${item.name} down`}
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
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
          <Button variant="outline" disabled={saving} onClick={() => navigate("/admin/home-sections")}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={saving || !form.title.trim()} onClick={() => void save()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
