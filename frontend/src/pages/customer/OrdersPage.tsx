import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ordersApi, reviewsApi } from "../../services/api/commerce.api";
import { EmptyState, ErrorState, Skeleton, Badge } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { entityId, mediaUrl, type Order, type OrderStatus } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { useMemo, useState } from "react";

const TRACK: OrderStatus[] = ["pending", "confirmed", "packed", "out_for_delivery", "delivered"];

const TRACK_LABEL: Record<string, string> = {
  pending: "Order placed",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  processing: "Processing",
  shipped: "Shipped",
  cancelled: "Cancelled",
};

type Tab = "all" | "processing" | "delivered" | "cancelled";

function statusTone(status: string): "sage" | "saffron" | "red" | "muted" {
  if (status === "delivered") return "sage";
  if (status === "cancelled") return "red";
  if (status === "pending") return "saffron";
  return "muted";
}

function matchesTab(order: Order, tab: Tab) {
  if (tab === "all") return true;
  if (tab === "delivered") return order.orderStatus === "delivered";
  if (tab === "cancelled") return order.orderStatus === "cancelled";
  return !["delivered", "cancelled"].includes(order.orderStatus);
}

export function OrdersPage() {
  const [tab, setTab] = useState<Tab>("all");
  const query = useQuery({ queryKey: ["orders"], queryFn: () => ordersApi.list(1) });
  const items = useMemo(() => (query.data?.items || []).filter((order) => matchesTab(order, tab)), [query.data, tab]);

  if (query.isLoading) return <Skeleton className="h-40" />;
  if (!query.data?.items.length) {
    return (
      <EmptyState
        title="No orders yet"
        body="When you place an order, it will appear here."
        action={<Link className="font-semibold text-yd-green" to="/products">Start shopping →</Link>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-yd-forest">My orders</h1>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {(
          [
            ["all", "All"],
            ["processing", "Processing"],
            ["delivered", "Delivered"],
            ["cancelled", "Cancelled"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tab === value ? "bg-yd-forest text-white" : "border border-yd-border bg-white text-yd-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!items.length ? (
        <EmptyState title="Nothing here" body="No orders in this tab yet." />
      ) : (
        <div className="space-y-3">
          {items.map((order) => (
            <article key={order.orderNumber} className="rounded-card border border-yd-border bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-yd-ink">{order.orderNumber}</p>
                  <p className="mt-0.5 text-sm text-yd-muted">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ₹{order.total}
                  </p>
                </div>
                <Badge tone={statusTone(order.orderStatus)}>{order.orderStatus.replace(/_/g, " ")}</Badge>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                {order.items.slice(0, 4).map((item) =>
                  item.productImage ? (
                    <img key={item.productId} src={mediaUrl(item.productImage)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  ) : null,
                )}
              </div>
              <div className="mt-3 flex items-center gap-3">
                {order.orderStatus === "delivered" ? (
                  <Link
                    to="/products"
                    className="inline-flex min-h-9 items-center rounded-full border border-yd-green px-4 text-sm font-semibold text-yd-green"
                  >
                    Buy again
                  </Link>
                ) : null}
                <Link to={`/orders/${entityId(order)}`} className="text-sm font-semibold text-yd-green">
                  View details →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const query = useQuery({ queryKey: ["order", id], queryFn: () => ordersApi.get(id), enabled: Boolean(id) });
  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(id),
    onSuccess: async () => {
      toast("Order cancelled");
      await queryClient.invalidateQueries({ queryKey: ["order", id] });
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Cannot cancel", "error"),
  });
  const review = useMutation({
    mutationFn: () => reviewsApi.create({ productId: reviewFor, orderId: id, rating, comment }),
    onSuccess: () => {
      toast("Review submitted");
      setReviewFor(null);
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Review failed", "error"),
  });

  if (query.isLoading) return <Skeleton className="h-64" />;
  if (query.isError || !query.data) return <ErrorState message="Order not found" />;
  const order = query.data.data;
  const statusForTrack =
    order.orderStatus === "processing" || order.orderStatus === "shipped"
      ? order.orderStatus === "processing"
        ? "confirmed"
        : "packed"
      : order.orderStatus;
  const currentIndex = TRACK.indexOf(statusForTrack as OrderStatus);

  return (
    <div className="space-y-5">
      <button className="text-sm font-semibold text-yd-green" onClick={() => navigate(-1)} type="button">
        ← Back
      </button>
      <div>
        <h1 className="font-display text-3xl text-yd-forest">{order.orderNumber}</h1>
        <p className="mt-1 capitalize text-yd-muted">
          {TRACK_LABEL[order.orderStatus] || order.orderStatus.replace(/_/g, " ")} · {order.paymentStatus} · ₹{order.total}
        </p>
      </div>

      <ol className="relative space-y-0 border-l-2 border-yd-border pl-5">
        {TRACK.map((status, index) => {
          const done = currentIndex >= 0 && index <= currentIndex;
          const active = currentIndex === index;
          return (
            <li key={status} className="relative pb-5 last:pb-0">
              <span
                className={`absolute -left-[1.55rem] top-0.5 h-3 w-3 rounded-full border-2 ${
                  done ? "border-yd-green bg-yd-green" : "border-yd-border bg-white"
                }`}
              />
              <p className={`text-sm font-semibold ${active ? "text-yd-green" : done ? "text-yd-ink" : "text-yd-muted"}`}>
                {TRACK_LABEL[status] || status.replace(/_/g, " ")}
              </p>
            </li>
          );
        })}
      </ol>

      <section className="rounded-card border border-yd-border bg-white p-4">
        <h2 className="font-semibold text-yd-ink">Delivery address</h2>
        <p className="mt-1 text-sm text-yd-muted">
          {order.shippingAddress?.fullName}
          <br />
          {order.shippingAddress?.addressLine1}, {order.shippingAddress?.city} {order.shippingAddress?.postalCode}
        </p>
      </section>

      <div className="space-y-3">
        {order.items.map((item) => (
          <article key={item.productId} className="flex gap-3 rounded-card border border-yd-border bg-white p-3">
            {item.productImage ? <img src={mediaUrl(item.productImage)} alt="" className="h-16 w-16 rounded-xl object-cover" /> : null}
            <div className="flex-1">
              <p className="font-semibold">{item.productName}</p>
              <p className="text-sm text-yd-muted">
                ₹{item.unitPrice} × {item.quantity}
              </p>
              {order.orderStatus === "delivered" ? (
                <button className="mt-1 text-sm font-semibold text-yd-saffron" type="button" onClick={() => setReviewFor(item.productId)}>
                  Write a review
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {["pending", "confirmed"].includes(order.orderStatus) ? (
        <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
          Cancel order
        </Button>
      ) : null}

      {reviewFor ? (
        <form
          className="rounded-card border border-yd-border bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            review.mutate();
          }}
        >
          <p className="font-semibold">Review product</p>
          <label className="mt-2 block text-sm">
            Rating
            <select className="mt-1 h-11 w-full rounded-xl border border-yd-border px-3" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <textarea className="mt-3 min-h-24 w-full rounded-xl border border-yd-border p-3 text-sm" value={comment} onChange={(e) => setComment(e.target.value)} required minLength={8} />
          <Button className="mt-3" loading={review.isPending}>
            Submit review
          </Button>
        </form>
      ) : null}
    </div>
  );
}
