import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProducts } from "../../hooks/useCatalog";
import { ProductCarousel, ProductGrid } from "../../components/product/ProductCarousel";
import { SectionHeader, Skeleton, EmptyState } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { useCommerceActions } from "../../hooks/useCommerceActions";
import { FESTIVALS, GIFT_BANDS, HELP_FAQS, OFFER_SECTIONS, REGIONS } from "../../content/discovery";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { scratchApi } from "../../services/api/commerce.api";
import { brandsApi, merchandisingApi } from "../../services/api/products.api";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { formatMoneyFromCents } from "../../utils/money";
import { useCurrencyCode } from "../../hooks/useSettings";
import { Breadcrumbs } from "../../components/navigation/Breadcrumbs";
import { MerchandisingCard } from "../../components/merchandising/MerchandisingCard";
import { mediaUrl } from "../../types";

function OfferRail({ title, query }: { title: string; query: { discount?: string; sort?: string; limit?: number; maxPrice?: number } }) {
  const list = useProducts(query);
  const { addToCart } = useCommerceActions();
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined) params.set(k, String(v));
  });
  return (
    <ProductCarousel
      title={title}
      products={list.data?.items || []}
      loading={list.isLoading}
      onAdd={(p) => addToCart.mutate({ product: p })}
      seeAllTo={`/products?${params.toString()}`}
    />
  );
}

function ScratchCardPanel() {
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const currency = useCurrencyCode();
  const campaign = useQuery({ queryKey: ["scratch-campaign"], queryFn: () => scratchApi.campaign() });
  const rewards = useQuery({
    queryKey: ["scratch-rewards"],
    queryFn: () => scratchApi.rewards(),
    enabled: Boolean(user),
  });
  const scratch = useMutation({
    mutationFn: () => scratchApi.scratch(campaign.data?.data?.id),
    onSuccess: async (result) => {
      toast(`You won: ${String(result.data.label || "a reward")}`);
      await queryClient.invalidateQueries({ queryKey: ["scratch-rewards"] });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Scratch failed", "error"),
  });
  const latest = rewards.data?.data?.[0] as
    | { id?: string; label?: string; code?: string; discountType?: string; discountValue?: number; status?: string }
    | undefined;

  return (
    <div className="rounded-card border border-yd-border bg-white p-5 shadow-soft">
      <p className="font-display text-2xl text-yd-forest">Scratch &amp; save</p>
      <p className="mt-1 text-sm text-yd-muted">
        {campaign.data?.data?.name || "Rewards are selected on the server — refreshing won’t re-roll."}
      </p>
      {user ? (
        <div className="mt-4 space-y-2">
          <Button disabled={scratch.isPending || !campaign.data?.data} onClick={() => scratch.mutate()}>
            {latest ? "View your reward" : "Scratch now"}
          </Button>
          {latest ? (
            <p className="text-sm text-yd-ink">
              {latest.label} · code <span className="font-semibold">{latest.code}</span> · {latest.status}
              {latest.discountType === "fixed" ? ` · ${formatMoneyFromCents(Number(latest.discountValue || 0), currency)}` : ""}
              <span className="mt-1 block text-xs text-yd-muted">Use reward ID at checkout: {latest.id}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-yd-muted">
          <Link to="/login" className="font-semibold text-yd-green">
            Sign in
          </Link>{" "}
          to scratch.
        </p>
      )}
    </div>
  );
}

export function OffersPage() {
  const merch = useQuery({
    queryKey: ["merchandising", "offers"],
    queryFn: () => merchandisingApi.list("offers"),
  });
  const { addToCart } = useCommerceActions();
  const rails = (merch.data?.data || []).filter((rail) => rail.products?.length);
  return (
    <div className="space-y-8">
      <Helmet>
        <title>Offers | Yogi&apos;s Depot</title>
      </Helmet>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Offers" }]} />
      <SectionHeader title="Offers for you" subtitle="Limited-time savings on Indian pantry favourites" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card bg-yd-saffron p-5 text-white">
          <p className="font-display text-2xl">Today&apos;s deals</p>
          <p className="mt-1 text-sm text-white/85">Snack smarter with seasonal discounts</p>
        </div>
        <ScratchCardPanel />
      </div>
      {rails.map((rail) => (
        <ProductCarousel
          key={rail.id}
          title={rail.name}
          subtitle={rail.subtitle}
          products={rail.products}
          onAdd={(p) => addToCart.mutate({ product: p })}
        />
      ))}
      {!rails.length
        ? OFFER_SECTIONS.map((section) => <OfferRail key={section.title} title={section.title} query={section.query} />)
        : null}
    </div>
  );
}

export function RegionsPage() {
  return (
    <div className="space-y-6">
      <Helmet>
        <title>Taste India | Yogi&apos;s Depot</title>
      </Helmet>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Taste India" }]} />
      <SectionHeader title="Taste India" subtitle="Regional favourites from kitchens across the country" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REGIONS.map((region) => (
          <Link
            key={region.slug}
            to={`/discover/regions/${region.slug}`}
            className="rounded-card border border-yd-border bg-white p-5 shadow-soft transition hover:border-yd-green/40"
          >
            <p className="font-display text-2xl text-yd-forest">{region.name}</p>
            <p className="mt-2 text-sm text-yd-muted">{region.description}</p>
            <p className="mt-3 text-xs font-semibold text-yd-green">{region.specialties.join(" · ")}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function RegionDetailPage() {
  const { slug = "" } = useParams();
  const region = REGIONS.find((item) => item.slug === slug);
  const merch = useQuery({
    queryKey: ["merchandising", "region-target", slug],
    queryFn: () => merchandisingApi.list(undefined, { region: slug }),
    enabled: Boolean(region),
  });
  const productsQuery = useProducts({ region: slug, limit: 24 });
  const { addToCart } = useCommerceActions();

  const rails = merch.data?.data || [];
  const loading = merch.isLoading;

  if (!region) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Taste India", to: "/discover/regions" }, { label: "Not found" }]} />
        <p className="font-display text-2xl">Region not found</p>
        <Link to="/discover/regions" className="text-sm font-semibold text-yd-green">
          Back to Taste India
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Helmet>
        <title>{region.name} | Taste India</title>
      </Helmet>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Taste India", to: "/discover/regions" },
          { label: region.name },
        ]}
      />
      <section className="rounded-card bg-yd-forest p-6 text-white">
        <p className="text-xs uppercase tracking-wide text-white/70">Taste India</p>
        <h1 className="mt-1 font-display text-3xl">{region.name}</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">{region.description}</p>
      </section>

      {loading ? <Skeleton className="h-48 rounded-card" /> : null}

      {!loading && rails.length ? (
        <section className="space-y-3">
          <SectionHeader title="Collections" subtitle={`Merchandising for ${region.name}`} />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {rails.map((rail) => (
              <MerchandisingCard key={rail.id} rail={rail} />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !rails.length ? (
        <EmptyState
          title={`No collections for ${region.name} yet`}
          body="Browse products from this region below, or check back soon for curated merchandising."
        />
      ) : null}

      <section className="space-y-3">
        <SectionHeader title={`${region.name} products`} subtitle="Products tagged for this region" />
        <ProductGrid
          products={productsQuery.data?.items || []}
          loading={productsQuery.isLoading}
          onAdd={(p) => addToCart.mutate({ product: p })}
        />
      </section>
    </div>
  );
}

export function MerchandisingCollectionPage() {
  const { slug = "" } = useParams();
  const { addToCart } = useCommerceActions();
  const query = useQuery({
    queryKey: ["merchandising-slug", slug],
    queryFn: () => merchandisingApi.bySlug(slug),
    enabled: Boolean(slug),
    retry: false,
  });
  const collection = query.data?.data;

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  if (query.isError || !collection) {
    return (
      <div className="space-y-3">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Collection" }]} />
        <p className="font-display text-2xl text-yd-forest">Collection not found</p>
        <p className="text-sm text-yd-muted">This merchandising may be inactive or outside its schedule.</p>
        <Link to="/" className="text-sm font-semibold text-yd-green">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Helmet>
        <title>{`${collection.name} | Yogi's Depot`}</title>
      </Helmet>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: collection.name }]} />
      <section className="relative overflow-hidden rounded-card bg-yd-forest p-6 text-white">
        {collection.image ? (
          <img src={mediaUrl(collection.image)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        ) : null}
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-wide text-white/70">Collection</p>
          <h1 className="mt-1 font-display text-3xl">{collection.name}</h1>
          {collection.subtitle ? <p className="mt-2 max-w-xl text-sm text-white/85">{collection.subtitle}</p> : null}
          <p className="mt-3 text-xs font-semibold text-yd-saffron">
            {collection.products?.length || 0} product{(collection.products?.length || 0) === 1 ? "" : "s"}
          </p>
        </div>
      </section>
      <ProductGrid
        products={collection.products || []}
        loading={false}
        onAdd={(p) => addToCart.mutate({ product: p })}
      />
    </div>
  );
}

export function FestivalPage() {
  const merch = useQuery({
    queryKey: ["merchandising", "festival"],
    queryFn: () => merchandisingApi.list("festival"),
  });
  const festivals = merch.data?.data || [];
  const showFallback = !merch.isLoading && !festivals.length;

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Festival store | Yogi&apos;s Depot</title>
      </Helmet>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Festival store" }]} />
      <SectionHeader title="Festival store" subtitle="Celebrate with sweets, snacks and gift-ready picks" />
      {merch.isLoading ? <Skeleton className="h-40 rounded-card" /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {festivals.map((festival) => (
          <Link
            key={festival.slug}
            to={`/festival/${festival.slug}`}
            className="overflow-hidden rounded-card border border-yd-border bg-white shadow-soft transition hover:border-yd-green/40"
          >
            {festival.image ? (
              <img src={mediaUrl(festival.image)} alt="" className="aspect-[16/9] w-full object-cover" />
            ) : null}
            <div className="p-5">
              <p className="font-display text-2xl text-yd-forest">{festival.name}</p>
              {festival.subtitle ? <p className="mt-2 text-sm text-yd-muted">{festival.subtitle}</p> : null}
              <p className="mt-3 text-xs font-semibold text-yd-green">
                {festival.products?.length || 0} product{(festival.products?.length || 0) === 1 ? "" : "s"}
              </p>
            </div>
          </Link>
        ))}
        {showFallback
          ? FESTIVALS.map((festival) => (
              <Link
                key={festival.slug}
                to={`/festival/${festival.slug}`}
                className="rounded-card border border-yd-border bg-white p-5 shadow-soft transition hover:border-yd-green/40"
              >
                <p className="font-display text-2xl text-yd-forest">{festival.name}</p>
                <p className="mt-2 text-sm text-yd-muted">{festival.blurb}</p>
              </Link>
            ))
          : null}
      </div>
    </div>
  );
}

export function FestivalDetailPage() {
  const { slug = "" } = useParams();
  const merch = useQuery({
    queryKey: ["merchandising-slug", slug],
    queryFn: () => merchandisingApi.bySlug(slug),
    enabled: Boolean(slug),
    retry: false,
  });
  const fallback = FESTIVALS.find((item) => item.slug === slug);
  const collection = merch.data?.data;
  const list = useProducts(
    collection ? { festival: slug, limit: 24 } : { search: fallback?.search, limit: 12 },
  );
  const { addToCart } = useCommerceActions();

  const name = collection?.name || fallback?.name;
  const blurb = collection?.subtitle || fallback?.blurb;
  const products = collection?.products?.length ? collection.products : list.data?.items || [];
  const loading = merch.isLoading || (!collection?.products?.length && list.isLoading);

  if (!merch.isLoading && !collection && !fallback) {
    return (
      <div>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Festival store", to: "/festival" }, { label: "Not found" }]}
        />
        <p className="font-display text-2xl">Festival not found</p>
        <Link to="/festival" className="text-sm font-semibold text-yd-green">
          Back to Festival store
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Helmet>
        <title>{name || "Festival"} | Festival store</title>
      </Helmet>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Festival store", to: "/festival" },
          { label: name || "Festival" },
        ]}
      />
      <section className="rounded-card bg-yd-forest p-6 text-white">
        <p className="text-xs uppercase tracking-wide text-white/70">Festival store</p>
        <h1 className="mt-1 font-display text-3xl">{name}</h1>
        {blurb ? <p className="mt-2 max-w-xl text-sm text-white/80">{blurb}</p> : null}
      </section>
      <ProductGrid products={products} loading={loading} onAdd={(p) => addToCart.mutate({ product: p })} />
    </div>
  );
}

export function GiftsPage() {
  const [band, setBand] = useState<string>(GIFT_BANDS[0].slug);
  const selected = GIFT_BANDS.find((item) => item.slug === band) || GIFT_BANDS[0];
  const list = useProducts({
    maxPrice: "maxPrice" in selected ? Number(selected.maxPrice) : undefined,
    minPrice: "minPrice" in selected ? Number(selected.minPrice) : undefined,
    sort: "popular",
    limit: 12,
  });
  const merch = useQuery({
    queryKey: ["merchandising", "gifts"],
    queryFn: () => merchandisingApi.list("gifts"),
  });
  const { addToCart } = useCommerceActions();
  const rails = (merch.data?.data || []).filter((rail) => rail.products?.length);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Gift hampers | Yogi&apos;s Depot</title>
      </Helmet>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Gift hampers" }]} />
      <SectionHeader title="Gift hampers" subtitle="Office, family, festival and corporate gifting" />
      {rails.map((rail) => (
        <ProductCarousel
          key={rail.id}
          title={rail.name}
          subtitle={rail.subtitle}
          products={rail.products}
          onAdd={(p) => addToCart.mutate({ product: p })}
        />
      ))}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GIFT_BANDS.map((item) => (
          <button
            key={item.slug}
            type="button"
            onClick={() => setBand(item.slug)}
            className={`rounded-card border p-4 text-left ${band === item.slug ? "border-yd-green bg-yd-green/10" : "border-yd-border bg-white"}`}
          >
            <p className="font-semibold text-yd-ink">{item.name}</p>
            <p className="mt-1 text-xs text-yd-muted">{item.blurb}</p>
          </button>
        ))}
      </div>
      {!rails.length ? (
        <ProductGrid products={list.data?.items || []} loading={list.isLoading} onAdd={(p) => addToCart.mutate({ product: p })} />
      ) : null}
    </div>
  );
}

export function BrandsPage() {
  const brands = useQuery({ queryKey: ["public-brands"], queryFn: () => brandsApi.list() });
  const items = brands.data?.data || [];

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Brands | Yogi&apos;s Depot</title>
      </Helmet>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Brands" }]} />
      <SectionHeader title="Shop by brand" subtitle="Trusted labels from kitchens across India" />
      {brands.isLoading ? (
        <p className="text-sm text-yd-muted">Loading brands…</p>
      ) : !items.length ? (
        <p className="text-sm text-yd-muted">Brand names will appear as products are catalogued.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((brand) => (
            <Link
              key={brand.slug}
              to={`/brands/${brand.slug}`}
              className="overflow-hidden rounded-card border border-yd-border bg-white text-center shadow-soft hover:border-yd-green/40"
            >
              {brand.logoUrl ? (
                <img src={mediaUrl(brand.logoUrl)} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : null}
              <p className="p-4 font-semibold">{brand.name}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function BrandDetailPage() {
  const { slug = "" } = useParams();
  const brandQuery = useQuery({
    queryKey: ["public-brand", slug],
    queryFn: () => brandsApi.bySlug(slug),
    enabled: Boolean(slug),
    retry: false,
  });
  const brand = brandQuery.data?.data;
  const label = brand?.name || decodeURIComponent(slug);
  const list = useProducts({ brand: brand?.slug || decodeURIComponent(slug), limit: 24, sort: "popular" });
  const { addToCart } = useCommerceActions();

  return (
    <div className="space-y-6">
      <Helmet>
        <title>{label} | Yogi&apos;s Depot</title>
      </Helmet>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Brands", to: "/brands" }, { label }]} />
      <SectionHeader title={label} subtitle={brand?.description || "Bestsellers and pantry picks from this brand"} />
      <ProductGrid products={list.data?.items || []} loading={list.isLoading || brandQuery.isLoading} onAdd={(p) => addToCart.mutate({ product: p })} />
    </div>
  );
}

export function HelpPage() {
  const [open, setOpen] = useState<string | null>(HELP_FAQS[0]?.items[0]?.q || null);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Help & support | Yogi&apos;s Depot</title>
      </Helmet>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Help centre" }]} />
      <SectionHeader title="Help centre" subtitle="Orders, payments, returns and account support" />
      {HELP_FAQS.map((group) => (
        <section key={group.category} className="space-y-2">
          <h2 className="font-display text-xl text-yd-forest">{group.category}</h2>
          {group.items.map((item) => {
            const isOpen = open === item.q;
            return (
              <div key={item.q} className="rounded-card border border-yd-border bg-white">
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold"
                  onClick={() => setOpen(isOpen ? null : item.q)}
                  aria-expanded={isOpen}
                >
                  {item.q}
                  <ChevronDown className={`h-4 w-4 shrink-0 text-yd-muted transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen ? <p className="border-t border-yd-border px-4 py-3 text-sm text-yd-muted">{item.a}</p> : null}
              </div>
            );
          })}
        </section>
      ))}
      <div className="rounded-card border border-yd-border bg-yd-cream/50 p-5">
        <p className="font-display text-xl text-yd-forest">Need more help?</p>
        <p className="mt-1 text-sm text-yd-muted">Email support@yogisdepot.local or check your order details for delivery updates.</p>
        <Link to="/orders" className="mt-3 inline-flex text-sm font-semibold text-yd-green">
          Go to my orders →
        </Link>
      </div>
    </div>
  );
}
