import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Leaf, ShieldCheck, Truck } from "lucide-react";
import { useProducts, useCategories, useWishlist } from "../../hooks/useCatalog";
import { homeSectionsApi, merchandisingApi } from "../../services/api/products.api";
import { ProductCarousel } from "../../components/product/ProductCarousel";
import { MerchandisingCardCarousel } from "../../components/merchandising/MerchandisingCard";
import { CategoryChipCarousel } from "../../components/category/CategoryCard";
import { buildHomeHeroSlides, HomeHeroCarousel } from "../../components/home/HomeHeroCarousel";
import { mediaUrl, entityId, type Product, type Category } from "../../types";
import { Skeleton, SectionHeader } from "../../components/ui/Feedback";
import { useCommerceActions } from "../../hooks/useCommerceActions";
import { HomeFestivalStoreSection } from "../../components/discovery/HomeFestivalStoreSection";
import { SameDayDeliveryBanner } from "../../components/commerce/SameDayDeliveryBanner";

const TRUST_DESKTOP = [
  { icon: Leaf, label: "Authentic & Fresh" },
  { icon: ShieldCheck, label: "Trusted Local Makers" },
  { icon: Truck, label: "Safe & Secure Delivery" },
];

const TRUST_MOBILE = [
  { icon: Truck, label: "Fast Delivery Today" },
  { icon: Leaf, label: "Fresh & Authentic Products" },
  { icon: ShieldCheck, label: "Secure Payments" },
];

const SECTION_SEE_ALL: Partial<Record<"bestsellers" | "deals" | "featured" | "new_arrivals", string>> = {
  bestsellers: "/products?sort=popular",
  deals: "/offers",
  new_arrivals: "/products?sort=newest",
};

export function HomePage() {
  const homeSections = useQuery({
    queryKey: ["home-sections"],
    queryFn: () => homeSectionsApi.list(),
  });
  const popularFallback = useProducts({ sort: "popular", limit: 1 });
  const dealsFallback = useProducts({ discount: "true", sort: "discount", limit: 1 });
  const merch = useQuery({
    queryKey: ["merchandising", "home-rails"],
    queryFn: () => merchandisingApi.list(),
  });
  const homeRails = (merch.data?.data || []).filter(
    (rail) =>
      rail.products?.length &&
      (rail.placement === "home" || rail.placement === "offers" || rail.placement === "gifts"),
  );
  const categories = useCategories();
  const { addToCart, toggleWishlist } = useCommerceActions();
  const wishlist = useWishlist();
  const wished = new Set((wishlist.data?.data || []).map((p: Product) => entityId(p)));
  const parents = (categories.data?.data || []).filter((c) => !c.parentId);
  const heroImage = mediaUrl(
    popularFallback.data?.items?.[0]?.thumbnail || popularFallback.data?.items?.[0]?.images?.[0],
  );
  const teaImage = mediaUrl(dealsFallback.data?.items?.[0]?.thumbnail || dealsFallback.data?.items?.[0]?.images?.[0]);
  const heroSlides = useMemo(
    () =>
      buildHomeHeroSlides({
        rails: homeRails,
        categories: parents,
        fallbackImage: heroImage || teaImage,
      }),
    [homeRails, parents, heroImage, teaImage],
  );

  const sections = homeSections.data?.data || [];
  const onAdd = (p: Product) => addToCart.mutate({ product: p });
  const onWish = (p: Product) => toggleWishlist.mutate({ product: p, wished: wished.has(entityId(p)) });

  const heroColumnRef = useRef<HTMLDivElement>(null);
  const [heroHeight, setHeroHeight] = useState<number>();

  // Match the categories rail to the hero column (banner + carousel + trust tiles),
  // not the other way around — stretch made the sidebar inflate the measured height.
  useLayoutEffect(() => {
    const column = heroColumnRef.current;
    if (!column || typeof ResizeObserver === "undefined") return;

    const update = () => {
      const next = Math.round(column.getBoundingClientRect().height);
      setHeroHeight((prev) => (prev === next ? prev : next));
    };

    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(column);
    for (const child of Array.from(column.children)) {
      observer.observe(child);
    }
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [heroSlides.length]);

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 lg:space-y-10">
      <Helmet>
        <title>Yogi&apos;s Depot — Taste Authentic India Everyday</title>
        <meta name="description" content="Everyday favourites from trusted brands of South Asia" />
      </Helmet>

      <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-start">
        <aside
          className="hidden w-[220px] shrink-0 self-start lg:flex"
          style={heroHeight ? { height: heroHeight } : undefined}
        >
          <nav className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[14px] border border-yd-border bg-white p-3 shadow-soft">
            <p className="mb-2 shrink-0 px-2 text-xs font-semibold uppercase tracking-wide text-yd-muted">
              Categories
            </p>
            <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
              {parents.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    to={`/categories/${cat.slug}`}
                    className="flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium text-yd-ink hover:bg-yd-bg"
                  >
                    <CategoryDot category={cat} />
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-1 shrink-0 border-t border-yd-border/70 pt-1">
              <Link
                to="/categories"
                className="flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold text-yd-green"
              >
                All categories →
              </Link>
            </div>
          </nav>
        </aside>

        <div ref={heroColumnRef} className="min-w-0 w-full flex-1 space-y-5">
          <SameDayDeliveryBanner />
          <HomeHeroCarousel slides={heroSlides} />

          <div className="grid grid-cols-3 gap-2 lg:hidden">
            {TRUST_MOBILE.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1.5 rounded-[12px] border border-yd-border bg-white px-2 py-3 text-center">
                <item.icon className="h-4 w-4 text-yd-green" />
                <span className="text-[10px] font-semibold leading-tight text-yd-ink">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="hidden grid-cols-3 gap-2 lg:grid">
            {TRUST_DESKTOP.map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-[12px] border border-yd-border bg-white px-3 py-2.5">
                <item.icon className="h-4 w-4 shrink-0 text-yd-green" />
                <span className="text-xs font-semibold leading-tight text-yd-ink">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section>
        <SectionHeader title="Shop by category" action={<Link to="/categories" className="text-sm font-semibold text-yd-green">View all</Link>} />
        <div className="grid grid-cols-4 gap-3 sm:hidden">
          {(categories.isLoading ? [] : parents.slice(0, 4)).map((cat) => (
            <Link key={cat.slug} to={`/categories/${cat.slug}`} className="flex flex-col items-center gap-1.5 text-center">
              <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-yd-border bg-yd-cream">
                {cat.image ? <img src={mediaUrl(cat.image)} alt="" className="h-full w-full object-cover" /> : <span className="font-display text-lg text-yd-forest">{cat.name[0]}</span>}
              </span>
              <span className="line-clamp-2 text-[11px] font-medium">{cat.name}</span>
            </Link>
          ))}
          {categories.isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mx-auto h-16 w-16 rounded-full" />)
            : null}
        </div>
        <div className="hidden sm:block">
          {categories.isLoading ? (
            <div className="flex gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[68px] w-[68px] shrink-0 rounded-full" />)}</div>
          ) : (
            <CategoryChipCarousel categories={parents} />
          )}
        </div>
      </section>

      <MerchandisingCardCarousel
        title="Grab It Before It’s Gone!🔥"
        subtitle="Tap a card to browse the products inside"
        rails={homeRails}
      />

      <HomeFestivalStoreSection />

      {homeSections.isLoading
        ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-7 w-40" />
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 4 }).map((__, j) => (
                  <Skeleton key={j} className="h-56 w-40 shrink-0 rounded-2xl" />
                ))}
              </div>
            </div>
          ))
        : null}

      {!homeSections.isLoading
        ? sections
            .filter((section) => section.products?.length)
            .map((section) => (
              <ProductCarousel
                key={section.key}
                title={section.title}
                subtitle={section.subtitle}
                products={section.products}
                wished={wished}
                onAdd={onAdd}
                onWishlist={onWish}
                seeAllTo={SECTION_SEE_ALL[section.key]}
              />
            ))
        : null}

      <div className="rounded-[14px] bg-yd-saffron px-5 py-5 text-center text-white sm:flex sm:items-center sm:justify-between sm:text-left">
        <div>
          <p className="font-display text-xl sm:text-2xl">Wholesome food. Happier homes.</p>
          <p className="mt-0.5 text-sm text-white/90">Free delivery on orders over $75</p>
        </div>
        <Link to="/products" className="mt-3 inline-flex min-h-10 items-center rounded-full bg-yd-green px-5 text-sm font-bold text-white hover:bg-yd-green-dark sm:mt-0">
          Shop Now
        </Link>
      </div>
    </div>
  );
}

function CategoryDot({ category }: { category: Category }) {
  const image = mediaUrl(category.image);
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-yd-cream">
      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-yd-forest">{category.name[0]}</span>}
    </span>
  );
}
