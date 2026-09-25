import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useProducts } from "../../hooks/useCatalog";
import { ProductCarousel } from "../../components/product/ProductCarousel";
import { SectionHeader } from "../../components/ui/Feedback";
import { useCommerceActions } from "../../hooks/useCommerceActions";
import { FESTIVALS, GIFT_BANDS, HELP_FAQS, OFFER_SECTIONS, REGIONS } from "../../content/discovery";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useParams } from "react-router-dom";
import { ProductGrid } from "../../components/product/ProductCarousel";

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

export function OffersPage() {
  return (
    <div className="space-y-8">
      <Helmet>
        <title>Offers | Yogi&apos;s Depot</title>
      </Helmet>
      <SectionHeader title="Offers for you" subtitle="Limited-time savings on Indian pantry favourites" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card bg-yd-saffron p-5 text-white">
          <p className="font-display text-2xl">Today&apos;s deals</p>
          <p className="mt-1 text-sm text-white/85">Snack smarter with seasonal discounts</p>
        </div>
        <div className="rounded-card border border-yd-border bg-yd-cream/70 p-5">
          <p className="font-display text-2xl text-yd-forest">Combo picks</p>
          <p className="mt-1 text-sm text-yd-muted">Pair chai with biscuits or chips with dip</p>
        </div>
      </div>
      {OFFER_SECTIONS.map((section) => (
        <OfferRail key={section.title} title={section.title} query={section.query} />
      ))}
    </div>
  );
}

export function RegionsPage() {
  return (
    <div className="space-y-6">
      <Helmet>
        <title>Taste India | Yogi&apos;s Depot</title>
      </Helmet>
      <SectionHeader title="Taste India" subtitle="Regional favourites from kitchens across the country" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REGIONS.map((region) => (
          <Link key={region.slug} to={`/discover/regions/${region.slug}`} className="rounded-card border border-yd-border bg-white p-5 shadow-soft">
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
  const list = useProducts({ search: region?.search, limit: 12 });
  const { addToCart } = useCommerceActions();

  if (!region) {
    return (
      <div>
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
      <section className="rounded-card bg-yd-forest p-6 text-white">
        <p className="text-xs uppercase tracking-wide text-white/70">Taste India</p>
        <h1 className="mt-1 font-display text-3xl">{region.name}</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">{region.description}</p>
      </section>
      <ProductGrid products={list.data?.items || []} loading={list.isLoading} onAdd={(p) => addToCart.mutate({ product: p })} />
    </div>
  );
}

export function FestivalPage() {
  const [active, setActive] = useState<string>(FESTIVALS[0].slug);
  const festival = FESTIVALS.find((item) => item.slug === active) || FESTIVALS[0];
  const list = useProducts({ search: festival.search, limit: 12 });
  const { addToCart } = useCommerceActions();

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Festival store | Yogi&apos;s Depot</title>
      </Helmet>
      <SectionHeader title="Festival store" subtitle="Celebrate with sweets, snacks and gift-ready picks" />
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {FESTIVALS.map((item) => (
          <button
            key={item.slug}
            type="button"
            onClick={() => setActive(item.slug)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${active === item.slug ? "bg-yd-saffron text-white" : "border border-yd-border bg-white"}`}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="rounded-card border border-yd-border bg-yd-cream/50 p-5">
        <h2 className="font-display text-2xl text-yd-forest">{festival.name}</h2>
        <p className="mt-1 text-sm text-yd-muted">{festival.blurb}</p>
      </div>
      <ProductGrid products={list.data?.items || []} loading={list.isLoading} onAdd={(p) => addToCart.mutate({ product: p })} />
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
  const { addToCart } = useCommerceActions();

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Gift hampers | Yogi&apos;s Depot</title>
      </Helmet>
      <SectionHeader title="Gift hampers" subtitle="Office, family, festival and corporate gifting" />
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
      <ProductGrid products={list.data?.items || []} loading={list.isLoading} onAdd={(p) => addToCart.mutate({ product: p })} />
    </div>
  );
}

export function BrandsPage() {
  const list = useProducts({ limit: 48, sort: "popular" });
  const brands = Array.from(
    new Set((list.data?.items || []).map((item) => item.brand).filter((brand): brand is string => Boolean(brand))),
  ).sort();

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Brands | Yogi&apos;s Depot</title>
      </Helmet>
      <SectionHeader title="Shop by brand" subtitle="Trusted labels from kitchens across India" />
      {list.isLoading ? (
        <p className="text-sm text-yd-muted">Loading brands…</p>
      ) : !brands.length ? (
        <p className="text-sm text-yd-muted">Brand names will appear as products are catalogued.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {brands.map((brand) => (
            <Link key={brand} to={`/brands/${encodeURIComponent(brand)}`} className="rounded-card border border-yd-border bg-white p-4 text-center font-semibold shadow-soft hover:border-yd-green/40">
              {brand}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function BrandDetailPage() {
  const { slug = "" } = useParams();
  const brand = decodeURIComponent(slug);
  const list = useProducts({ brand, limit: 24, sort: "popular" });
  const { addToCart } = useCommerceActions();

  return (
    <div className="space-y-6">
      <Helmet>
        <title>{brand} | Yogi&apos;s Depot</title>
      </Helmet>
      <SectionHeader title={brand} subtitle="Bestsellers and pantry picks from this brand" />
      <ProductGrid products={list.data?.items || []} loading={list.isLoading} onAdd={(p) => addToCart.mutate({ product: p })} />
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
      <SectionHeader title="Help centre" subtitle="Orders, payments, returns and account support" />
      {HELP_FAQS.map((group) => (
        <section key={group.category} className="space-y-2">
          <h2 className="font-display text-xl text-yd-forest">{group.category}</h2>
          {group.items.map((item) => {
            const isOpen = open === item.q;
            return (
              <div key={item.q} className="rounded-card border border-yd-border bg-white">
                <button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold" onClick={() => setOpen(isOpen ? null : item.q)} aria-expanded={isOpen}>
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
