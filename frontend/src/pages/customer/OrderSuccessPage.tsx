import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Package } from "lucide-react";
import { ordersApi } from "../../services/api/commerce.api";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Feedback";
import { entityId } from "../../types";
import { useProducts } from "../../hooks/useCatalog";
import { ProductCarousel } from "../../components/product/ProductCarousel";
import { useCommerceActions } from "../../hooks/useCommerceActions";
import { formatCad } from "../../utils/money";
import { OrderSuccessAnimation } from "../../components/order/OrderSuccessAnimation";
import {
  markOrderSuccessCelebrated,
  shouldCelebrateOrderSuccess,
  type OrderSuccessNavigateState,
} from "../../store/orderSuccessUi.store";
import { scrollToTop } from "../../utils/scroll";

export function OrderSuccessPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const orderId = params.get("orderId") || "";
  const navigateState = (location.state || {}) as OrderSuccessNavigateState;
  const decidedRef = useRef(false);
  const [playCelebration, setPlayCelebration] = useState(false);

  // Land at the top so the confirmation / bike celebration is visible immediately.
  useEffect(() => {
    scrollToTop();
  }, [orderId]);

  const order = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersApi.get(orderId),
    enabled: Boolean(orderId),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.paymentStatus;
      // Keep polling while online payment is still settling.
      if (status === "pending") return 3000;
      return false;
    },
  });
  const recommended = useProducts({ sort: "popular", limit: 8 });
  const { addToCart } = useCommerceActions();

  const data = order.data?.data;
  const isCod = data?.paymentMethod === "cod";
  const isPaid = data?.paymentStatus === "paid";
  const isProcessing = Boolean(data && !isCod && data.paymentStatus === "pending");
  const isFailed = data?.paymentStatus === "failed";
  const isConfirmedSuccess = Boolean(data && (isPaid || isCod) && !isFailed && !isProcessing);

  // Latch celebration once so remounts/refetches cannot restart or cancel mid-ride.
  useEffect(() => {
    if (decidedRef.current || !orderId || !data) return;
    if (!isConfirmedSuccess) return;
    decidedRef.current = true;
    const shouldPlay = shouldCelebrateOrderSuccess({
      orderId,
      navigateCelebrateOrderId: navigateState.celebrateOrderId,
      isConfirmedSuccess: true,
    });
    if (shouldPlay) {
      markOrderSuccessCelebrated(orderId);
      setPlayCelebration(true);
    }
  }, [data, orderId, isConfirmedSuccess, navigateState.celebrateOrderId]);

  if (!orderId) {
    return (
      <EmptyState
        title="No order found"
        body="Place an order to see your confirmation here."
        action={
          <Link className="font-semibold text-yd-green" to="/products">
            Continue shopping
          </Link>
        }
      />
    );
  }
  if (order.isLoading) return <Skeleton className="h-64" />;
  if (order.isError || !data) return <ErrorState message="Unable to load order confirmation" />;

  const resolvedId = entityId(data);
  const deliveryNote =
    data.shippingAddress?.city
      ? `Preparing delivery to ${data.shippingAddress.city}`
      : "Your Yogis Depot goodies are getting ready for delivery.";

  if (isConfirmedSuccess) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <OrderSuccessAnimation
          orderNumber={data.orderNumber}
          orderId={resolvedId}
          deliveryNote={`${deliveryNote} · Total ${formatCad(data.total)} · ${
            isCod ? "Cash on delivery" : "Paid online"
          }`}
          playCelebration={playCelebration}
        />
        <ProductCarousel
          title="You may also like"
          products={recommended.data?.items || []}
          loading={recommended.isLoading}
          onAdd={(p) => addToCart.mutate({ product: p })}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <div className="rounded-[16px] border border-yd-border bg-white px-6 py-10 shadow-soft">
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <Package className="h-14 w-14 text-yd-forest" strokeWidth={1.5} />
          {isProcessing ? (
            <Loader2 className="absolute -bottom-1 -right-1 h-8 w-8 animate-spin rounded-full bg-white text-yd-saffron" />
          ) : (
            <CheckCircle2
              className={`absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-white ${
                isFailed ? "text-yd-error" : "text-yd-success"
              }`}
            />
          )}
        </div>
        <h1 className="mt-5 font-display text-3xl text-yd-forest">
          {isProcessing ? "Payment processing" : isFailed ? "Payment not confirmed" : "Order placed successfully!"}
        </h1>
        <p className="mt-2 text-sm text-yd-muted">
          {isProcessing
            ? "Your card payment is still being confirmed. This page updates automatically."
            : isFailed
              ? "We could not confirm this payment. Your cart items may still be available — try checkout again."
              : "Thank you. Your pantry favourites are being prepared."}
        </p>
        <div className="mt-5 rounded-[12px] bg-yd-green/10 px-4 py-3 text-left">
          <p className="text-sm font-semibold text-yd-ink">{data.orderNumber}</p>
          <p className="mt-1 text-sm text-yd-muted">
            Total {formatCad(data.total)} ·{" "}
            {isProcessing ? "Payment processing" : data.paymentStatus}
          </p>
          {data.shippingAddress?.city ? (
            <p className="mt-1 text-sm text-yd-muted">Delivery to {data.shippingAddress.city}</p>
          ) : null}
        </div>
        <Link
          to={`/orders/${resolvedId}`}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-yd-saffron text-sm font-bold text-white hover:bg-yd-terracotta"
        >
          View Order →
        </Link>
        <div className="mt-3 flex flex-col gap-2 text-sm font-semibold">
          <Link to="/products" className="text-yd-muted">
            Continue shopping
          </Link>
        </div>
      </div>
      <ProductCarousel
        title="You may also like"
        products={recommended.data?.items || []}
        loading={recommended.isLoading}
        onAdd={(p) => addToCart.mutate({ product: p })}
      />
    </div>
  );
}
