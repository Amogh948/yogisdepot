import { Link } from "react-router-dom";
import type { Product } from "../../types";
import { entityId } from "../../types";
import { ProductCard } from "./ProductCard";
import { ProductCardSkeleton, SectionHeader } from "../ui/Feedback";

export function ProductCarousel({
  title,
  subtitle,
  products,
  loading,
  wished,
  onAdd,
  onWishlist,
  seeAllTo,
}: {
  title: string;
  subtitle?: string;
  products: Product[];
  loading?: boolean;
  wished?: Set<string>;
  onAdd?: (product: Product) => void;
  onWishlist?: (product: Product) => void;
  seeAllTo?: string;
}) {
  return (
    <section className="w-full min-w-0 max-w-full">
      <SectionHeader
        title={title}
        subtitle={subtitle}
        action={
          seeAllTo ? (
            <Link to={seeAllTo} className="shrink-0 text-sm font-semibold text-yd-green">
              See all
            </Link>
          ) : null
        }
      />
      {/*
        grid-auto-flow + overflow-x contains horizontal scroll without expanding page width.
        Avoid flex + w-max (min-content size leaks to ancestors).
      */}
      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-3 pt-0.5 no-scrollbar lg:overflow-visible lg:pb-1">
        <div className="grid w-full grid-flow-col grid-cols-none gap-2.5 [grid-auto-columns:minmax(9rem,9.5rem)] lg:grid lg:grid-flow-row lg:grid-cols-4 lg:gap-3 lg:[grid-auto-columns:unset] xl:grid-cols-5 2xl:grid-cols-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : products.map((product) => (
                <ProductCard
                  key={product.slug}
                  product={product}
                  onAdd={onAdd}
                  onWishlist={onWishlist}
                  wished={wished?.has(entityId(product))}
                />
              ))}
        </div>
      </div>
    </section>
  );
}

export function ProductGrid({
  products,
  loading,
  wished,
  onAdd,
  onWishlist,
}: {
  products: Product[];
  loading?: boolean;
  wished?: Set<string>;
  onAdd?: (product: Product) => void;
  onWishlist?: (product: Product) => void;
}) {
  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
      {loading
        ? Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)
        : products.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              onAdd={onAdd}
              onWishlist={onWishlist}
              wished={wished?.has(entityId(product))}
            />
          ))}
    </div>
  );
}
