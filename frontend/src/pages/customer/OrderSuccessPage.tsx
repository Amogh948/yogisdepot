import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Package } from "lucide-react";
import { ordersApi } from "../../services/api/commerce.api";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Feedback";
import { entityId } from "../../types";
import { useProducts } from "../../hooks/useCatalog";
import { ProductCarousel } from "../../components/product/ProductCarousel";
import { useCommerceActions } from "../../hooks/useCommerceActions";
import { formatCad } from "../../utils/money";

export function OrderSuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId") || "";
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
  if (order.isError || !order.data) return <ErrorState message="Unable to load order confirmation" />;

  const data = order.data.data;
  const isCod = data.paymentMethod === "cod";
  const isPaid = data.paymentStatus === "paid";
  const isProcessing = !isCod && data.paymentStatus === "pending";
  const isFailed = data.paymentStatus === "failed";

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
          {isProcessing
            ? "Payment processing"
            : isFailed
              ? "Payment not confirmed"
              : isPaid || isCod
                ? "Payment successful"
                : "Order placed successfully!"}
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
            {isCod
              ? "Cash on delivery"
              : isPaid
                ? "Paid online"
                : isProcessing
                  ? "Payment processing"
                  : data.paymentStatus}
          </p>
          <p className="mt-1 text-sm text-yd-muted">
            Est. delivery in 2–4 days · {data.shippingAddress?.city}
          </p>
        </div>
        <Link
          to={`/orders/${entityId(data)}`}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-yd-saffron text-sm font-bold text-white hover:bg-yd-terracotta"
        >
          Track order →
        </Link>
        <div className="mt-3 flex flex-col gap-2 text-sm font-semibold">
          <Link to={`/orders/${entityId(data)}`} className="text-yd-green">
            View order details
          </Link>
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
