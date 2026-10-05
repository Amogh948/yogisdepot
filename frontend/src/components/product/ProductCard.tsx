import { Heart, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type { Product } from "../../types";
import { entityId, mediaUrl } from "../../types";
import { Price, QuantitySelector, Rating } from "../ui/Feedback";
import { useCartQuantity } from "../../hooks/useCatalog";
import { useCommerceActions } from "../../hooks/useCommerceActions";

interface ProductCardProps {
  product: Product;
  onAdd?: (product: Product) => void;
  onWishlist?: (product: Product) => void;
  wished?: boolean;
}

function productWeight(product: Product) {
  const weight = (product as Product & { weight?: number }).weight;
  if (weight) return `${weight}${product.unit || "g"}`;
  if (product.unit && product.unit !== "pack") return product.unit;
  return product.servingSize || null;
}

function primaryImageUrl(product: Product): string {
  if (product.thumbnail) return mediaUrl(product.thumbnail);
  const images = product.images;
  if (!Array.isArray(images) || images.length === 0) return "";
  const first = images[0] as unknown;
  if (typeof first === "string") return mediaUrl(first);
  if (first && typeof first === "object" && "url" in first) {
    return mediaUrl(String((first as { url?: string }).url || ""));
  }
  return "";
}

export function ProductCard({ product, onAdd, onWishlist, wished }: ProductCardProps) {
  const image = primaryImageUrl(product);
  const productId = entityId(product);
  const quantity = useCartQuantity(productId);
  const { setCartQuantity } = useCommerceActions();
  const pending = Boolean(
    setCartQuantity.isPending && setCartQuantity.variables && entityId(setCartQuantity.variables.product) === productId,
  );
  const weight = productWeight(product);
  const outOfStock = product.stock <= 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-[14px] border border-yd-border/60 bg-white shadow-soft">
      <Link to={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-yd-cream">
        {image ? (
          <img src={image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-yd-muted">No image</div>
        )}
        {product.discount > 0 ? (
          <span className="absolute left-2 top-2 rounded-md bg-yd-saffron px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
            {product.discount}% OFF
          </span>
        ) : null}
        {onWishlist ? (
          <button
            type="button"
            aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white shadow-soft"
            onClick={(event) => {
              event.preventDefault();
              onWishlist(product);
            }}
          >
            <Heart className={`h-4 w-4 ${wished ? "fill-yd-error text-yd-error" : "text-yd-muted"}`} />
          </button>
        ) : null}
        {outOfStock ? (
          <span className="absolute inset-x-0 bottom-0 bg-yd-ink/70 py-1 text-center text-[11px] font-semibold text-white">Out of stock</span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <Link to={`/products/${product.slug}`} className="line-clamp-2 min-h-[2.4rem] text-[13px] font-semibold leading-snug text-yd-ink">
          {product.name}
        </Link>
        {weight ? <p className="text-[11px] text-yd-muted">{weight}</p> : null}
        <Rating value={product.rating || 0} count={product.reviewCount} />
        <div className="mt-auto flex items-center justify-between gap-1.5 pt-1.5">
          <Price price={product.price} compareAt={product.compareAtPrice} />
          {onAdd ? (
            quantity > 0 ? (
              <QuantitySelector
                size="sm"
                value={quantity}
                min={0}
                max={Math.max(1, product.stock)}
                disabled={pending}
                onChange={(next) => setCartQuantity.mutate({ product, quantity: next })}
              />
            ) : (
              <button
                type="button"
                aria-label={`Add ${product.name} to cart`}
                className="inline-flex h-8 items-center gap-0.5 rounded-lg bg-yd-green px-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-40"
                disabled={outOfStock || pending}
                onClick={() => setCartQuantity.mutate({ product, quantity: 1 })}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Add
              </button>
            )
          ) : null}
        </div>
      </div>
    </article>
  );
}
