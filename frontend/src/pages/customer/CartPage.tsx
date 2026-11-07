import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCart, useProducts } from "../../hooks/useCatalog";
import { cartApi } from "../../services/api/commerce.api";
import { Button } from "../../components/ui/Button";
import { EmptyState, Price, QuantitySelector, Skeleton } from "../../components/ui/Feedback";
import { DeliveryProgress } from "../../components/commerce/DeliveryProgress";
import {
  SameDayDeliveryBanner,
  useSameDayDeliveryStatus,
} from "../../components/commerce/SameDayDeliveryBanner";
import { ProductCarousel } from "../../components/product/ProductCarousel";
import { mediaUrl, type Product } from "../../types";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";
import {
  ensureCartSynced,
  useCartSyncPending,
  useCommerceActions,
} from "../../hooks/useCommerceActions";
import { usePublicSettings } from "../../hooks/useSettings";
import { useDeliveryCoverage } from "../../hooks/useDeliveryCoverage";
import { DeliveryCoverageNotice } from "../../components/commerce/DeliveryCoverageNotice";
import { formatCad } from "../../utils/money";
import { returnPolicyLabel } from "../../utils/dates";
import { resolveEstimatedDeliveryLabel } from "../../utils/sameDayDelivery";
import { emptyCart } from "../../utils/cartOptimistic";
import { maxOrderQuantity } from "../../utils/quantity";
import type { ApiSuccess, Cart } from "../../types";
import {
  clearGuestCart,
  syncGuestChildren,
  updateGuestItem,
  useGuestCartStore,
  type GuestCartItem,
} from "../../store/guestCart.store";

function guestAsProduct(item: GuestCartItem, all: GuestCartItem[]): Product {
  const parentQty = Math.max(1, item.quantity);
  const children = all
    .filter((row) => row.parentProductId === item.productId)
    .map((row) => ({
      productId: row.productId,
      quantity: Math.max(1, Math.round(row.quantity / parentQty) || 1),
      name: row.name,
      price: row.price,
      image: row.image,
    }));
  return {
    id: item.productId,
    _id: item.productId,
    name: item.name || "Product",
    slug: item.productId,
    description: "",
    price: item.price ?? 0,
    images: item.image ? [item.image] : [],
    thumbnail: item.image,
    stock: 999,
    rating: 0,
    reviewCount: 0,
    isVegetarian: true,
    unit: "",
    childProducts: children,
  } as Product;
}

export function CartPage() {
  const user = useAuthStore((s) => s.user);
  const cart = useCart();
  const guestItems = useGuestCartStore((s) => s.items);
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const recommended = useProducts({ sort: "popular", limit: 8 });
  const { addToCart, setCartQuantity } = useCommerceActions();
  const cartSyncPending = useCartSyncPending();
  const [checkoutStarting, setCheckoutStarting] = useState(false);
  const publicSettings = usePublicSettings();
  const coverage = useDeliveryCoverage();
  const sameDayStatus = useSameDayDeliveryStatus();
  const deliveryTimeZone = publicSettings.data?.sameDayTimezone || "America/Edmonton";

  const goToCheckout = async () => {
    if (checkoutStarting) return;
    if (coverage.orderingBlocked) {
      toast(coverage.message || "We can't deliver to this location yet.", "error");
      return;
    }
    if (!user) {
      navigate("/login", { state: { from: "/checkout" } });
      return;
    }
    setCheckoutStarting(true);
    try {
      await ensureCartSynced(queryClient);
      navigate("/checkout");
    } catch {
      toast("Could not sync cart. Please try again.", "error");
    } finally {
      setCheckoutStarting(false);
    }
  };
  const checkoutBusy = cartSyncPending || checkoutStarting;

  const clear = useMutation({
    mutationFn: async () => {
      if (!user) {
        clearGuestCart();
        return null;
      }
      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<ApiSuccess<Cart>>(["cart"]);
      queryClient.setQueryData<ApiSuccess<Cart>>(["cart"], {
        success: true,
        message: "Cart cleared",
        data: emptyCart(),
      });
      try {
        return await cartApi.clear();
      } catch (error) {
        queryClient.setQueryData(["cart"], previous);
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result) queryClient.setQueryData(["cart"], result);
      toast("Cart cleared");
    },
    onError: () => toast("Could not clear cart", "error"),
  });

  const setGuestQuantity = (item: GuestCartItem, quantity: number) => {
    const product = guestAsProduct(item, guestItems);
    updateGuestItem(item.productId, quantity, {
      image: item.image,
      name: item.name,
      price: item.price,
    });
    syncGuestChildren(item.productId, quantity, product.childProducts || []);
  };

  if (user && cart.isLoading && !cart.data) return <Skeleton className="h-48" />;

  const data = user
    ? cart.data?.data
    : {
        items: guestItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          lineTotal: (item.price ?? 0) * item.quantity,
          inStock: true,
          parentProductId: item.parentProductId,
          locked: Boolean(item.parentProductId),
          product: guestAsProduct(item, guestItems),
        })),
        subtotal: guestItems.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0),
        itemCount: guestItems.reduce((sum, item) => sum + item.quantity, 0),
      };

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
          {!user ? (
            <p className="rounded-xl border border-yd-border bg-yd-cream/50 px-3 py-2 text-sm text-yd-muted">
              You&apos;re shopping as a guest. Sign in when you&apos;re ready to checkout — your cart stays on this device until then.
            </p>
          ) : null}
          <DeliveryProgress subtotal={data.subtotal} />
          <SameDayDeliveryBanner compact />
          {data.items.filter((item) => !item.parentProductId).map((item) => (
            <div key={item.productId} className="space-y-2">
            <article className="flex gap-3 rounded-[14px] border border-yd-border bg-white p-3 shadow-soft">
              <img src={mediaUrl(item.product.thumbnail || item.product.images[0])} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover bg-yd-cream" />
              <div className="min-w-0 flex-1">
                <Link to={`/products/${item.product.slug}`} className="font-semibold text-yd-ink">
                  {item.product.name}
                </Link>
                <p className="text-xs text-yd-muted">{item.product.unit}</p>
              <Price price={item.product.price} compareAt={item.product.compareAtPrice} showBadge size="sm" />
              <p className="mt-1 text-[11px] text-yd-muted">
                Estimated delivery:{" "}
                {resolveEstimatedDeliveryLabel({
                  status: sameDayStatus,
                  timeZone: deliveryTimeZone,
                  fallbackDaysFromNow: item.product.deliveryEstimateDays ?? 5,
                })}
              </p>
              <p className="text-[11px] text-yd-muted">{returnPolicyLabel(item.product.returnWindowDays)}</p>
              {!item.inStock ? <p className="text-xs text-yd-error">Stock changed — update quantity</p> : null}
              <div className="mt-2 flex items-center justify-between">
                <QuantitySelector
                  value={item.quantity}
                  min={0}
                  max={maxOrderQuantity(item.product)}
                  onChange={(quantity) => {
                    if (user) {
                      setCartQuantity.mutate({ product: item.product, quantity });
                    } else {
                      const guest = guestItems.find((row) => row.productId === item.productId && !row.parentProductId);
                      if (guest) setGuestQuantity(guest, quantity);
                    }
                  }}
                />
                <button
                  type="button"
                  aria-label="Remove item"
                  className="grid h-10 w-10 place-items-center text-yd-muted hover:text-yd-error"
                  onClick={() => {
                    if (user) {
                      setCartQuantity.mutate({ product: item.product, quantity: 0 });
                    } else {
                      const guest = guestItems.find((row) => row.productId === item.productId && !row.parentProductId);
                      if (guest) setGuestQuantity(guest, 0);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatCad(item.lineTotal)}</p>
            </article>
            {data.items
              .filter((child) => child.parentProductId === item.productId)
              .map((child) => (
                <article
                  key={`${item.productId}-${child.productId}`}
                  className="ml-6 flex gap-3 rounded-[14px] border border-dashed border-yd-border bg-yd-cream/40 p-3"
                >
                  <img src={mediaUrl(child.product.thumbnail || child.product.images[0])} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover bg-white" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-yd-ink">{child.product.name}</p>
                    <p className="text-xs text-yd-muted">Included with {item.product.name}. Change the main item to update this.</p>
                    <p className="mt-1 text-sm text-yd-ink">Qty {child.quantity}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{formatCad(child.lineTotal)}</p>
                </article>
              ))}
            </div>
          ))}
        </div>

        <aside className="min-w-0 rounded-[14px] border border-yd-border bg-white p-4 shadow-soft lg:flex lg:h-full lg:flex-col">
          <h2 className="font-display text-xl text-yd-forest">Order summary</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {data.items.map((item) => (
              <li key={`${item.parentProductId || "own"}-${item.productId}`} className={`flex items-start justify-between gap-3 ${item.parentProductId ? "pl-3" : ""}`}>
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
            <DeliveryCoverageNotice className="mb-3 rounded-xl" />
            <Button className="w-full" size="lg" loading={checkoutBusy} disabled={checkoutBusy || coverage.orderingBlocked} onClick={() => void goToCheckout()}>
              {cartSyncPending ? "Updating cart…" : user ? "Proceed to checkout" : "Sign in to checkout"}
            </Button>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-medium text-yd-muted">
              <span>Secure Payments</span>
              <span>Home delivery</span>
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
          <Button variant="accent" className="flex-1" loading={checkoutBusy} disabled={checkoutBusy || coverage.orderingBlocked} onClick={() => void goToCheckout()}>
            {cartSyncPending ? "Updating…" : user ? "Checkout →" : "Sign in →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
