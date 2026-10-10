import { Link, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCart, useProducts } from "../../hooks/useCatalog";
import { cartApi } from "../../services/api/commerce.api";
import { Button } from "../../components/ui/Button";
import { EmptyState, Price, QuantitySelector, Skeleton } from "../../components/ui/Feedback";
import { DeliveryProgress } from "../../components/commerce/DeliveryProgress";
import { ProductCarousel } from "../../components/product/ProductCarousel";
import { mediaUrl } from "../../types";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";
import { useCommerceActions } from "../../hooks/useCommerceActions";
import { formatCad } from "../../utils/money";
import { formatEstimatedDeliveryDate, returnPolicyLabel } from "../../utils/dates";

export function CartPage() {
  const user = useAuthStore((s) => s.user);
  const cart = useCart();
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const recommended = useProducts({ sort: "popular", limit: 8 });
  const { addToCart } = useCommerceActions();
  const update = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      quantity <= 0 ? cartApi.remove(id) : cartApi.update(id, quantity),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: () => toast("Could not update cart", "error"),
  });
  const clear = useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast("Cart cleared");
    },
  });

  if (!user) {
    return (
      <EmptyState
        title="Sign in to sync your cart"
        body="Guest items are saved on this device. Sign in to checkout securely."
        action={<Button onClick={() => navigate("/login")}>Sign in</Button>}
      />
    );
  }
  if (cart.isLoading) return <Skeleton className="h-48" />;
  const data = cart.data?.data;
  if (!data?.items.length) {
    return (
      <EmptyState
        title="Your cart is empty"
        body="Looks like you haven't added anything yet. Browse our products and find something you love."
        action={<Button variant="accent" onClick={() => navigate("/products")}>Start shopping →</Button>}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-24 lg:pb-0">
      <div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 font-display text-2xl text-yd-forest sm:text-3xl">Your Cart ({data.itemCount} items)</h1>
            <button type="button" className="shrink-0 text-sm font-semibold text-yd-error" onClick={() => clear.mutate()} disabled={clear.isPending}>
              Clear cart
            </button>
          </div>
          <DeliveryProgress subtotal={data.subtotal} />
          {data.items.map((item) => (
            <article key={item.productId} className="flex gap-3 rounded-[14px] border border-yd-border bg-white p-3 shadow-soft">
              <img src={mediaUrl(item.product.thumbnail || item.product.images[0])} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover bg-yd-cream" />
              <div className="min-w-0 flex-1">
                <Link to={`/products/${item.product.slug}`} className="font-semibold text-yd-ink">
                  {item.product.name}
                </Link>
                <p className="text-xs text-yd-muted">{item.product.unit}</p>
              <Price price={item.product.price} compareAt={item.product.compareAtPrice} showBadge size="sm" />
              <p className="mt-1 text-[11px] text-yd-muted">
                Estimated delivery: {formatEstimatedDeliveryDate(item.product.deliveryEstimateDays ?? 5)}
              </p>
              <p className="text-[11px] text-yd-muted">{returnPolicyLabel(item.product.returnWindowDays)}</p>
              {!item.inStock ? <p className="text-xs text-yd-error">Stock changed — update quantity</p> : null}
              <div className="mt-2 flex items-center justify-between">
                <QuantitySelector value={item.quantity} min={0} onChange={(quantity) => update.mutate({ id: item.productId, quantity })} />
                <button type="button" aria-label="Remove item" className="grid h-10 w-10 place-items-center text-yd-muted hover:text-yd-error" onClick={() => update.mutate({ id: item.productId, quantity: 0 })}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatCad(item.lineTotal)}</p>
            </article>
          ))}
        </div>

        <aside className="min-w-0 rounded-[14px] border border-yd-border bg-white p-4 shadow-soft lg:flex lg:h-full lg:flex-col">
          <h2 className="font-display text-xl text-yd-forest">Order summary</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {data.items.map((item) => (
              <li key={item.productId} className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-yd-ink">
                  <span className="line-clamp-2 font-medium">{item.product.name}</span>
                  <span className="text-yd-muted"> × {item.quantity}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-yd-ink">{formatCad(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-yd-border pt-3 text-base font-semibold">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCad(data.subtotal)}</span>
          </div>
          <p className="mt-3 border-t border-yd-border pt-3 text-xs leading-relaxed text-yd-muted">
            Total bill with taxes will be calculated on the checkout page.
          </p>
          <div className="mt-4 hidden lg:mt-auto lg:block">
            <Button className="w-full" size="lg" onClick={() => navigate("/checkout")}>
              Proceed to checkout
            </Button>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-medium text-yd-muted">
              <span>Secure Payments</span>
              <span>Easy Returns</span>
              <span>Support</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="min-w-0">
        <ProductCarousel title="You may also like" products={recommended.data?.items || []} loading={recommended.isLoading} onAdd={(p) => addToCart.mutate({ product: p })} />
      </div>

      <div className="fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom))] left-0 z-30 w-full border-t border-yd-border bg-white p-3 lg:hidden" style={{ width: "100%", maxWidth: "100vw" }}>
        <div className="mx-auto flex w-full max-w-store items-center gap-3">
          <div>
            <p className="text-xs text-yd-muted">Total</p>
            <p className="text-lg font-bold text-yd-ink">{formatCad(data.subtotal)}</p>
          </div>
          <Button variant="accent" className="flex-1" onClick={() => navigate("/checkout")}>
            Checkout →
          </Button>
        </div>
      </div>
    </div>
  );
}
