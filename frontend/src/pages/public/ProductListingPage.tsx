import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ProductGrid } from "../../components/product/ProductCarousel";
import { BottomSheet } from "../../components/ui/Overlay";
import { EmptyState, ErrorState, Pagination } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { useCategories, useProducts, useWishlist } from "../../hooks/useCatalog";
import { useCommerceActions } from "../../hooks/useCommerceActions";
import { entityId } from "../../types";
import { SearchBar } from "../../components/navigation/SearchBar";
import { Breadcrumbs } from "../../components/navigation/Breadcrumbs";
import { TRENDING_SEARCHES } from "../../content/navigation";

export function ProductListingPage({ mode }: { mode: "all" | "search" | "category" }) {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const query = params.get("q") || "";
  const page = Number(params.get("page") || 1);
  const sort = params.get("sort") || "relevance";
  const vegetarian = params.get("vegetarian") || undefined;
  const minPrice = params.get("minPrice") ? Number(params.get("minPrice")) : undefined;
  const maxPrice = params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined;
  const rating = params.get("rating") ? Number(params.get("rating")) : undefined;
  const discount = params.get("discount") || undefined;
  const brand = params.get("brand") || undefined;

  const list = useProducts({
    page,
    limit: 12,
    search: mode === "search" ? query : undefined,
    category: mode === "category" ? slug : undefined,
    sort,
    vegetarian,
    minPrice,
    maxPrice,
    rating,
    discount,
    brand,
  });
  const categories = useCategories();
  const { addToCart, toggleWishlist } = useCommerceActions();
  const wishlist = useWishlist();
  const wished = new Set((wishlist.data?.data || []).map((p) => entityId(p)));
  const categoryName = (categories.data?.data || []).find((c) => c.slug === slug)?.name;

  const title =
    mode === "search"
      ? query
        ? `Results for “${query}”`
        : "Search"
      : mode === "category"
        ? categoryName || slug || "Category"
        : "All products";

  const set = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.set("page", "1");
    setParams(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (sort && sort !== "relevance") next.set("sort", sort);
    setParams(next);
    setFiltersOpen(false);
  };

  const filterForm = useMemo(
    () => (
      <div className="space-y-4">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={vegetarian === "true"} onChange={(e) => set("vegetarian", e.target.checked ? "true" : undefined)} />
          Vegetarian only
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={discount === "true"} onChange={(e) => set("discount", e.target.checked ? "true" : undefined)} />
          Discounted items
        </label>
        <label className="block text-sm font-medium">
          Min price
          <input className="mt-1 h-11 w-full rounded-xl border border-yd-border px-3" type="number" defaultValue={minPrice} onBlur={(e) => set("minPrice", e.target.value || undefined)} />
        </label>
        <label className="block text-sm font-medium">
          Max price
          <input className="mt-1 h-11 w-full rounded-xl border border-yd-border px-3" type="number" defaultValue={maxPrice} onBlur={(e) => set("maxPrice", e.target.value || undefined)} />
        </label>
        <label className="block text-sm font-medium">
          Minimum rating
          <select className="mt-1 h-11 w-full rounded-xl border border-yd-border px-3" value={rating || ""} onChange={(e) => set("rating", e.target.value || undefined)}>
            <option value="">Any</option>
            <option value="4">4+</option>
            <option value="3">3+</option>
          </select>
        </label>
        <div className="space-y-1 text-sm">
          <p className="font-medium">Category</p>
          {(categories.data?.data || [])
            .filter((c) => !c.parentId)
            .map((cat) => (
              <Link key={cat.slug} className="block py-2 text-yd-muted hover:text-yd-green" to={`/categories/${cat.slug}`} onClick={() => setFiltersOpen(false)}>
                {cat.name}
              </Link>
            ))}
        </div>
      </div>
    ),
    [vegetarian, discount, minPrice, maxPrice, rating, categories.data],
  );

  const total = list.data?.pagination?.total;

  return (
    <div className="w-full">
      <Helmet>
        <title>{`${title} | Yogi's Depot`}</title>
      </Helmet>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          ...(mode === "category"
            ? [
                { label: "Categories", to: "/categories" },
                { label: title },
              ]
            : mode === "search"
              ? [{ label: "Search" }, ...(query ? [{ label: query }] : [])]
              : [{ label: "Products" }]),
        ]}
      />

      {mode === "search" ? (
        <div className="mb-4 w-full space-y-4">
          <SearchBar autoFocus />
          {!query ? (
            <div className="rounded-card border border-yd-border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-yd-muted">Trending searches</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {TRENDING_SEARCHES.map((term) => (
                  <Link key={term} to={`/search?q=${encodeURIComponent(term)}`} className="rounded-full border border-yd-border px-3 py-2 text-sm font-medium hover:border-yd-green">
                    {term}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex w-full min-w-0 flex-col gap-8 lg:flex-row">
      <aside className="hidden w-[260px] shrink-0 lg:block">
        <div className="sticky top-28 rounded-card border border-yd-border bg-white p-4 shadow-soft">
          <h2 className="mb-3 font-display text-xl text-yd-forest">Filters</h2>
          {filterForm}
          <Button variant="outline" className="mt-4 w-full" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      </aside>

      <div className="min-w-0 w-full flex-1">
        <div className="mb-4">
          <h1 className="font-display text-[26px] capitalize text-yd-forest lg:text-3xl">{title}</h1>
          {typeof total === "number" ? <p className="mt-0.5 text-sm text-yd-muted">{total} products</p> : null}
          <div className="mt-3 flex gap-2 lg:hidden">
            <Button variant="outline" className="flex-1" onClick={() => setSortOpen(true)}>
              Sort
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setFiltersOpen(true)}>
              Filter
            </Button>
          </div>
          <div className="mt-3 hidden items-center gap-3 lg:flex">
            <label className="text-sm font-medium text-yd-muted">
              Sort
              <select className="ml-2 h-11 rounded-full border border-yd-border bg-white px-3 text-yd-ink" value={sort} onChange={(e) => set("sort", e.target.value)}>
                <option value="relevance">Relevance</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Rating</option>
                <option value="newest">Newest</option>
                <option value="popular">Popular</option>
                <option value="discount">Discount</option>
              </select>
            </label>
          </div>
        </div>

        {list.isLoading ? (
          <ProductGrid products={[]} loading />
        ) : list.isError ? (
          <ErrorState message="Unable to load products" retry={() => list.refetch()} />
        ) : !list.data?.items.length ? (
          <EmptyState
            title="No products found"
            body="Try another search or clear a few filters."
            action={
              <Button variant="primary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <ProductGrid
              products={list.data.items}
              wished={wished}
              onAdd={(p) => addToCart.mutate({ product: p })}
              onWishlist={(p) => toggleWishlist.mutate({ product: p, wished: wished.has(entityId(p)) })}
            />
            <Pagination page={page} totalPages={list.data.pagination.totalPages} onPage={(next) => set("page", String(next))} />
          </>
        )}
      </div>
      </div>

      <BottomSheet
        open={filtersOpen}
        title="Filters"
        onClose={() => setFiltersOpen(false)}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={clearFilters}>
              Clear all
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Apply
            </Button>
          </div>
        }
      >
        {filterForm}
      </BottomSheet>

      <BottomSheet open={sortOpen} title="Sort by" onClose={() => setSortOpen(false)}>
        <div className="space-y-1">
          {[
            ["relevance", "Relevance"],
            ["popular", "Popular"],
            ["price_asc", "Price: Low to High"],
            ["price_desc", "Price: High to Low"],
            ["rating", "Rating"],
            ["newest", "Newest"],
            ["discount", "Discount"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`flex min-h-12 w-full items-center rounded-xl px-3 text-left text-sm font-medium ${sort === value ? "bg-yd-green/10 text-yd-green" : "hover:bg-yd-bg"}`}
              onClick={() => {
                set("sort", value);
                setSortOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
