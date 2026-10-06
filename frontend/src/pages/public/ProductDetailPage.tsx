import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import { Heart, Truck } from "lucide-react";
import { useProduct, useWishlist } from "../../hooks/useCatalog";
import { useQuery } from "@tanstack/react-query";
import { productsApi } from "../../services/api/products.api";
import { reviewsApi } from "../../services/api/commerce.api";
import { Button } from "../../components/ui/Button";
import { Badge, EmptyState, ErrorState, Price, QuantitySelector, Rating, Skeleton, SectionHeader } from "../../components/ui/Feedback";
import { ProductCarousel } from "../../components/product/ProductCarousel";
import { useCommerceActions } from "../../hooks/useCommerceActions";
import { entityId, mediaUrl } from "../../types";
import { Breadcrumbs } from "../../components/navigation/Breadcrumbs";

export function ProductDetailPage() {
  const { slug = "" } = useParams();
  const productQuery = useProduct(slug);
  const product = productQuery.data?.data;
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const { addToCart, toggleWishlist } = useCommerceActions();
  const navigate = useNavigate();
  const wishlist = useWishlist();
  const wished = Boolean(product && (wishlist.data?.data || []).some((item) => entityId(item) === entityId(product)));
  const related = useQuery({
    queryKey: ["related", product ? entityId(product) : ""],
    queryFn: () => productsApi.related(entityId(product!)),
    enabled: Boolean(product),
  });
  const reviews = useQuery({
    queryKey: ["reviews", product ? entityId(product) : ""],
    queryFn: () => reviewsApi.forProduct(entityId(product!)),
    enabled: Boolean(product),
  });

  if (productQuery.isLoading) return <Skeleton className="h-96" />;
  if (productQuery.isError || !product) return <ErrorState message="Product not found" />;

  const images = product.images.length ? product.images : [product.thumbnail || ""];
  const vendor = typeof product.vendorId === "object" ? product.vendorId : undefined;
  const weight = (product as typeof product & { weight?: number }).weight;

  return (
      <div className="min-w-0 pb-28 lg:pb-8">
      <Helmet>
        <title>{`${product.name} | Yogi's Depot`}</title>
        <meta name="description" content={product.shortDescription || product.description.slice(0, 140)} />
      </Helmet>

      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Products", to: "/products" },
          ...(typeof product.categoryId === "object" && product.categoryId?.slug
            ? [{ label: product.categoryId.name || "Category", to: `/categories/${product.categoryId.slug}` }]
            : []),
          { label: product.name },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div>
          <div className="aspect-square overflow-hidden rounded-card border border-yd-border bg-yd-cream">
            {images[active] ? <img src={mediaUrl(images[active])} alt={product.name} className="h-full w-full object-cover" /> : null}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
            {images.map((src, index) => (
              <button
                key={src + index}
                type="button"
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border ${index === active ? "border-yd-green ring-2 ring-yd-green/30" : "border-yd-border"}`}
                onClick={() => setActive(index)}
              >
                <img src={mediaUrl(src)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {product.isVegetarian ? <Badge tone="veg">Veg</Badge> : null}
            {product.stock > 0 ? <Badge tone="sage">In stock</Badge> : <Badge tone="red">Out of stock</Badge>}
            {product.discount > 0 ? <Badge tone="saffron">{product.discount}% OFF</Badge> : null}
          </div>
          {product.brand ? <p className="text-sm font-medium text-yd-muted">{product.brand}</p> : null}
          <h1 className="font-display text-3xl text-yd-forest lg:text-4xl">{product.name}</h1>
          <Rating value={product.rating} count={product.reviewCount} />
          <Price price={product.price} compareAt={product.compareAtPrice} />
          <p className="text-sm leading-relaxed text-yd-muted">{product.shortDescription || product.description}</p>
          {weight || product.unit ? (
            <p className="text-sm text-yd-ink">
              <span className="text-yd-muted">Pack size: </span>
              {weight ? `${weight}${product.unit || "g"}` : product.unit}
            </p>
          ) : null}
          <p className={`text-sm font-semibold ${product.stock > 0 ? "text-yd-success" : "text-yd-error"}`}>
            {product.stock > 0 ? (product.stock <= product.lowStockThreshold ? `Only ${product.stock} left` : "Available now") : "Currently unavailable"}
          </p>
          {vendor ? (
            <p className="text-sm text-yd-muted">
              Sold by <span className="font-semibold text-yd-ink">{vendor.businessName}</span>
            </p>
          ) : null}

          <div className="flex items-start gap-2 rounded-card border border-yd-border bg-white p-3 text-sm">
            <Truck className="mt-0.5 h-4 w-4 shrink-0 text-yd-green" />
            <div>
              <p className="font-semibold text-yd-ink">Delivery information</p>
              <p className="text-yd-muted">Packed fresh from vendor kitchens. Free delivery over $75.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <QuantitySelector value={qty} onChange={setQty} max={Math.max(1, product.stock)} />
            <button type="button" aria-label="Wishlist" className="grid h-11 w-11 place-items-center rounded-full border border-yd-border" onClick={() => toggleWishlist.mutate({ product, wished })}>
              <Heart className={`h-5 w-5 ${wished ? "fill-yd-error text-yd-error" : "text-yd-ink"}`} />
            </button>
          </div>
          <div className="hidden flex-col gap-2 pt-1 lg:flex">
            <Button size="lg" className="w-full" onClick={() => addToCart.mutate({ product, quantity: qty })} disabled={product.stock <= 0}>
              Add to cart
            </Button>
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              onClick={() => {
                addToCart.mutate({ product, quantity: qty });
                navigate("/checkout");
              }}
              disabled={product.stock <= 0}
            >
              Buy now
            </Button>
          </div>
        </div>
      </div>

      <section className="mt-8 space-y-4">
        <SectionHeader title="About this product" />
        <p className="text-sm leading-6 text-yd-ink">{product.description}</p>
        {product.ingredients ? (
          <p className="text-sm">
            <strong>Ingredients:</strong> {product.ingredients}
          </p>
        ) : null}
        {product.allergens?.length ? (
          <p className="text-sm">
            <strong>Allergens:</strong> {product.allergens.join(", ")}
          </p>
        ) : null}
        {product.storageInstructions ? (
          <p className="text-sm">
            <strong>Storage:</strong> {product.storageInstructions}
          </p>
        ) : null}
        {product.usageInstructions ? (
          <p className="text-sm">
            <strong>Usage:</strong> {product.usageInstructions}
          </p>
        ) : null}
        {product.nutritionInformation ? (
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {Object.entries(product.nutritionInformation).map(([key, value]) =>
              value !== undefined ? (
                <div key={key} className="rounded-card border border-yd-border bg-white p-3">
                  <p className="capitalize text-yd-muted">{key}</p>
                  <p className="font-semibold">{value}</p>
                </div>
              ) : null,
            )}
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        <SectionHeader title="Reviews" />
        {!reviews.data?.length ? (
          <EmptyState title="No reviews yet" body="Verified buyers can share tasting notes after delivery." />
        ) : (
          <div className="space-y-3">
            {reviews.data.map((review) => (
              <article key={review.createdAt} className="rounded-card border border-yd-border bg-white p-4">
                <Rating value={review.rating} />
                <p className="mt-1 font-semibold">{review.title}</p>
                <p className="text-sm text-yd-muted">{review.comment}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8">
        <ProductCarousel title="Similar products" products={related.data?.data || []} onAdd={(p) => addToCart.mutate({ product: p })} />
      </div>

      <div className="fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 w-full max-w-[100%] border-t border-yd-border bg-white px-4 py-3 lg:hidden">
        <div className="mx-auto flex w-full max-w-store flex-col gap-2">
          <Button size="lg" className="w-full" onClick={() => addToCart.mutate({ product, quantity: qty })} disabled={product.stock <= 0}>
            Add to cart
          </Button>
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            onClick={() => {
              addToCart.mutate({ product, quantity: qty });
              navigate("/checkout");
            }}
            disabled={product.stock <= 0}
          >
            Buy now
          </Button>
        </div>
      </div>
    </div>
  );
}
