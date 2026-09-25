import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Leaf, RefreshCcw, ShieldCheck, Truck } from "lucide-react";
import { useProducts, useCategories, useWishlist } from "../../hooks/useCatalog";
import { ProductCarousel } from "../../components/product/ProductCarousel";
import { CategoryChipCarousel } from "../../components/category/CategoryCard";
import { mediaUrl, entityId, type Product, type Category } from "../../types";
import { Skeleton, SectionHeader } from "../../components/ui/Feedback";
import { useCommerceActions } from "../../hooks/useCommerceActions";

const TRUST_DESKTOP = [
  { icon: Leaf, label: "Authentic & Fresh" },
  { icon: ShieldCheck, label: "Trusted Local Makers" },
  { icon: Truck, label: "Safe & Secure Delivery" },
  { icon: RefreshCcw, label: "Easy Returns" },
];

const TRUST_MOBILE = [
  { icon: Truck, label: "Fast Delivery Today" },
  { icon: Leaf, label: "Fresh & Authentic Products" },
  { icon: ShieldCheck, label: "Secure Payments" },
];

export function HomePage() {
  const featured = useProducts({ featured: "true", limit: 8 });
  const popular = useProducts({ sort: "popular", limit: 8 });
  const deals = useProducts({ discount: "true", sort: "discount", limit: 8 });
  const newest = useProducts({ sort: "newest", limit: 8 });
  const categories = useCategories();
  const { addToCart, toggleWishlist } = useCommerceActions();
  const wishlist = useWishlist();
  const wished = new Set((wishlist.data?.data || []).map((p: Product) => entityId(p)));
  const parents = (categories.data?.data || []).filter((c) => !c.parentId);
  const heroImage = mediaUrl(popular.data?.items?.[0]?.thumbnail || popular.data?.items?.[0]?.images?.[0]);
  const teaImage = mediaUrl(deals.data?.items?.[0]?.thumbnail || deals.data?.items?.[0]?.images?.[0]);

  const onAdd = (p: Product) => addToCart.mutate({ product: p });
  const onWish = (p: Product) => toggleWishlist.mutate({ product: p, wished: wished.has(entityId(p)) });

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 lg:space-y-10">
      <Helmet>
        <title>Yogi&apos;s Depot — Taste Authentic India Everyday</title>
        <meta name="description" content="Snacks, teas, spices and pantry staples from trusted local kitchens." />
      </Helmet>

      {/* Desktop: sidebar + hero — flex avoids 220px grid trap when aside is hidden */}
      <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row">
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <nav className="sticky top-28 rounded-[14px] border border-yd-border bg-white p-3 shadow-soft">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-yd-muted">Categories</p>
            <ul className="space-y-0.5">
              {parents.map((cat) => (
                <li key={cat.slug}>
                  <Link to={`/categories/${cat.slug}`} className="flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium text-yd-ink hover:bg-yd-bg">
                    <CategoryDot category={cat} />
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/categories" className="flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold text-yd-green">
                  View all →
                </Link>
              </li>
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 w-full flex-1 space-y-5">
          {/* Mobile location already in header; quick category chips on mobile are in header */}

          <section className="relative overflow-hidden rounded-[16px] bg-yd-forest min-h-[220px] sm:min-h-[280px] lg:min-h-[340px]">
            {heroImage ? (
              <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-r from-yd-forest via-yd-forest/75 to-yd-forest/20" />
            <div className="relative z-10 flex h-full max-w-xl flex-col justify-center p-5 sm:p-8 lg:p-10">
              <h1 className="font-display text-[28px] leading-[1.15] text-white sm:text-4xl lg:text-[42px]">
                <span className="lg:hidden">Everyday Indian favourites, delivered with care.</span>
                <span className="hidden lg:inline">Taste Authentic India Everyday</span>
              </h1>
              <p className="mt-2 hidden text-sm text-white/80 sm:text-base lg:block">
                Snacks, teas, spices and pantry staples from trusted local kitchens.
              </p>
              <Link
                to="/products"
                className="mt-5 inline-flex min-h-11 w-fit items-center rounded-full bg-yd-saffron px-6 text-sm font-bold text-white shadow-soft hover:bg-yd-terracotta"
              >
                <span className="lg:hidden">Shop now →</span>
                <span className="hidden lg:inline">Shop Now</span>
              </Link>
            </div>
          </section>

          <div className="grid grid-cols-3 gap-2 lg:hidden">
            {TRUST_MOBILE.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1.5 rounded-[12px] border border-yd-border bg-white px-2 py-3 text-center">
                <item.icon className="h-4 w-4 text-yd-green" />
                <span className="text-[10px] font-semibold leading-tight text-yd-ink">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="hidden grid-cols-4 gap-2 lg:grid">
            {TRUST_DESKTOP.map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-[12px] border border-yd-border bg-white px-3 py-2.5">
                <item.icon className="h-4 w-4 shrink-0 text-yd-green" />
                <span className="text-xs font-semibold leading-tight text-yd-ink">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="hidden gap-3 lg:grid lg:grid-cols-2">
            <Link to="/categories/snacks" className="relative overflow-hidden rounded-[14px] min-h-[120px] bg-yd-cream">
              {heroImage ? <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" /> : null}
              <div className="relative z-10 flex h-full flex-col justify-end p-4">
                <p className="font-display text-xl text-yd-forest">Snacks for Every Mood</p>
                <span className="mt-2 inline-flex w-fit rounded-full bg-yd-forest px-3 py-1 text-xs font-bold text-white">Shop</span>
              </div>
            </Link>
            <Link to="/categories/beverages" className="relative overflow-hidden rounded-[14px] min-h-[120px] bg-yd-forest">
              {teaImage ? <img src={teaImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" /> : null}
              <div className="relative z-10 flex h-full flex-col justify-end p-4">
                <p className="font-display text-xl text-white">Premium Teas from India</p>
                <span className="mt-2 inline-flex w-fit rounded-full bg-yd-saffron px-3 py-1 text-xs font-bold text-white">Shop</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <section>
        <SectionHeader title="Shop by category" action={<Link to="/categories" className="text-sm font-semibold text-yd-green">View all</Link>} />
        {/* Mobile: 2x2 circular grid per wireframe; also horizontal scroll for more */}
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

      <ProductCarousel
        title="Bestsellers"
        loading={popular.isLoading}
        products={popular.data?.items || []}
        wished={wished}
        onAdd={onAdd}
        onWishlist={onWish}
        seeAllTo="/products?sort=popular"
      />

      <ProductCarousel
        title="Today's deals"
        loading={deals.isLoading}
        products={deals.data?.items || []}
        wished={wished}
        onAdd={onAdd}
        onWishlist={onWish}
        seeAllTo="/offers"
      />

      <ProductCarousel
        title="New arrivals"
        loading={newest.isLoading}
        products={newest.data?.items || []}
        wished={wished}
        onAdd={onAdd}
        onWishlist={onWish}
        seeAllTo="/products?sort=newest"
      />

      <ProductCarousel
        title="Featured picks"
        loading={featured.isLoading}
        products={featured.data?.items || []}
        wished={wished}
        onAdd={onAdd}
        onWishlist={onWish}
      />

      <div className="rounded-[14px] bg-yd-saffron px-5 py-5 text-center text-white sm:flex sm:items-center sm:justify-between sm:text-left">
        <div>
          <p className="font-display text-xl sm:text-2xl">Wholesome food. Happier homes.</p>
          <p className="mt-0.5 text-sm text-white/90">Free delivery on orders over ₹499</p>
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
