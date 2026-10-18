import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import { Heart, RotateCcw, Truck } from "lucide-react";
import { useProduct, useWishlist } from "../../hooks/useCatalog";
import { useQuery } from "@tanstack/react-query";
import { productsApi } from "../../services/api/products.api";
import { Button } from "../../components/ui/Button";
import { Badge, ErrorState, Price, QuantitySelector, Skeleton, SectionHeader } from "../../components/ui/Feedback";
import { ProductCarousel } from "../../components/product/ProductCarousel";
import { ProductImageGallery } from "../../components/product/ProductImageGallery";
import { useCommerceActions } from "../../hooks/useCommerceActions";
import { entityId } from "../../types";
import { Breadcrumbs } from "../../components/navigation/Breadcrumbs";
import { BackLink } from "../../components/navigation/BackLink";
import { returnPolicyLabel } from "../../utils/dates";
import { maxOrderQuantity } from "../../utils/quantity";
import { resolveStockDisplay } from "../../utils/stockDisplay";
import { resolveEstimatedDeliveryLabel } from "../../utils/sameDayDelivery";
import {
  SameDayDeliveryBanner,
  useSameDayDeliveryStatus,
} from "../../components/commerce/SameDayDeliveryBanner";
import { scrollToTop } from "../../utils/scroll";
import { usePublicSettings } from "../../hooks/useSettings";

export function ProductDetailPage() {
  const { slug = "" } = useParams();
  const productQuery = useProduct(slug);
  const product = productQuery.data?.data;
  const publicSettings = usePublicSettings();
  const sameDayStatus = useSameDayDeliveryStatus();
  const [qty, setQty] = useState(1);
  const { addToCart, toggleWishlist } = useCommerceActions();
  const navigate = useNavigate();
  const wishlist = useWishlist();
  const wished = Boolean(product && (wishlist.data?.data || []).some((item) => entityId(item) === entityId(product)));
  const related = useQuery({
    queryKey: ["related", product ? entityId(product) : ""],
    queryFn: () => productsApi.related(entityId(product!)),
    enabled: Boolean(product),
  });

  // Home (and other) carousels leave the window scrolled mid-page — animate to top on open.
  useEffect(() => {
    scrollToTop("smooth");
    setQty(1);
  }, [slug]);

  if (productQuery.isLoading) return <Skeleton className="h-96" />;
  if (productQuery.isError || !product) return <ErrorState message="Product not found" />;

  const images = product.images.length ? product.images : [product.thumbnail || ""];
  const vendor = typeof product.vendorId === "object" ? product.vendorId : undefined;
  const weight = (product as typeof product & { weight?: number }).weight;
  const stockDisplay = resolveStockDisplay({
    unlimitedQuantity: product.unlimitedQuantity,
    stock: product.stock,
    lowStockDisplayThreshold: publicSettings.data?.lowStockDisplayThreshold,
    inStockDisplayThreshold: publicSettings.data?.inStockDisplayThreshold,
  });
  const stockToneClass =
    stockDisplay.tone === "red"
      ? "text-yd-error"
      : stockDisplay.tone === "yellow"
        ? "text-yd-saffron"
        : "text-yd-success";
  const stockBadgeTone =
    stockDisplay.tone === "red" ? "red" : stockDisplay.tone === "yellow" ? "saffron" : "sage";
  const deliveryTimeZone = publicSettings.data?.sameDayTimezone || "America/Edmonton";
  const estimatedDeliveryLabel = resolveEstimatedDeliveryLabel({
    status: sameDayStatus,
    timeZone: deliveryTimeZone,
    fallbackDaysFromNow: product.deliveryEstimateDays ?? 5,
  });
  const estimatedDeliveryHint =
    sameDayStatus?.mode === "same_day"
      ? "Same-day delivery while the timer is running."
      : sameDayStatus?.mode === "next_day"
        ? "Same-day cutoff has passed — next calendar day."
        : "Estimate from order date.";

  return (
      <div className="min-w-0 pb-28 lg:pb-8">
      <Helmet>
        <title>{`${product.name} | Yogi's Depot`}</title>
        <meta name="description" content={product.shortDescription || product.description.slice(0, 140)} />
      </Helmet>

      <div className="mb-3 flex items-center gap-3">
        <BackLink fallback="/products" className="text-sm font-semibold text-yd-green">
          ← Back
        </BackLink>
      </div>
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
        <ProductImageGallery images={images} alt={product.name} />

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {product.isVegetarian ? <Badge tone="veg">Veg</Badge> : null}
            <Badge tone={stockBadgeTone}>{stockDisplay.label}</Badge>
            {product.discount > 0 ? <Badge tone="saffron">{product.discount}% OFF</Badge> : null}
          </div>
          {product.brand ? <p className="text-sm font-medium text-yd-muted">{product.brand}</p> : null}
          <h1 className="font-display text-3xl text-yd-forest lg:text-4xl">{product.name}</h1>
          <Price price={product.price} compareAt={product.compareAtPrice} showBadge />
          <p className="text-sm leading-relaxed text-yd-muted">{product.shortDescription || product.description}</p>
          {weight || product.unit ? (
            <p className="text-sm text-yd-ink">
              <span className="text-yd-muted">Pack size: </span>
              {weight ? `${weight}${product.unit || "g"}` : product.unit}
            </p>
          ) : null}
          <p className={`text-sm font-semibold ${stockToneClass}`}>{stockDisplay.label}</p>
          {vendor ? (
            <p className="text-sm text-yd-muted">
              Sold by <span className="font-semibold text-yd-ink">{vendor.businessName}</span>
            </p>
          ) : null}

          <SameDayDeliveryBanner compact />
          <div className="flex items-start gap-2 rounded-card border border-yd-border bg-white p-3 text-sm">
            <Truck className="mt-0.5 h-4 w-4 shrink-0 text-yd-green" />
            <div>
              <p className="font-semibold text-yd-ink">Estimated delivery</p>
              <p className="text-yd-muted">Estimated delivery: {estimatedDeliveryLabel}</p>
              <p className="mt-1 text-xs text-yd-muted">{estimatedDeliveryHint}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-card border border-yd-border bg-white p-3 text-sm">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-yd-forest" />
            <div>
              <p className="font-semibold text-yd-ink">Returns</p>
              <p className="text-yd-muted">{returnPolicyLabel(product.returnWindowDays)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <QuantitySelector value={qty} onChange={setQty} max={maxOrderQuantity(product)} />
            <button type="button" aria-label="Wishlist" className="grid h-11 w-11 place-items-center rounded-full border border-yd-border" onClick={() => toggleWishlist.mutate({ product, wished })}>
              <Heart className={`h-5 w-5 ${wished ? "fill-yd-error text-yd-error" : "text-yd-ink"}`} />
            </button>
          </div>
          <div className="hidden flex-col gap-2 pt-1 lg:flex">
            <Button
              size="lg"
              className="w-full"
              onClick={() => addToCart.mutate({ product, quantity: qty })}
              disabled={product.unlimitedQuantity === false && product.stock <= 0}
            >
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
              disabled={product.unlimitedQuantity === false && product.stock <= 0}
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

      <div className="mt-8">
        <ProductCarousel title="Similar products" products={related.data?.data || []} onAdd={(p) => addToCart.mutate({ product: p })} />
      </div>

      <div className="fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 w-full max-w-[100%] border-t border-yd-border bg-white px-4 py-3 lg:hidden">
        <div className="mx-auto flex w-full max-w-store flex-col gap-2">
          <Button
            size="lg"
            className="w-full"
            onClick={() => addToCart.mutate({ product, quantity: qty })}
            disabled={product.unlimitedQuantity === false && product.stock <= 0}
          >
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
            disabled={product.unlimitedQuantity === false && product.stock <= 0}
          >
            Buy now
          </Button>
        </div>
      </div>
    </div>
  );
}
