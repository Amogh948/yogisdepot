import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { ordersApi, reviewsApi } from "../../services/api/commerce.api";
import { EmptyState, ErrorState, Skeleton, Badge } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, Modal } from "../../components/ui/Overlay";
import { Input } from "../../components/ui/Input";
import { entityId, mediaUrl, type Order, type OrderStatus } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { useMemo, useState } from "react";
import { formatCad } from "../../utils/money";

type CancellationReason =
  | "changed_my_mind"
  | "better_deal"
  | "ordered_by_mistake"
  | "delivery_too_long"
  | "other";

const CANCEL_REASONS: Array<{ value: CancellationReason; label: string }> = [
  { value: "changed_my_mind", label: "Changed my mind" },
  { value: "better_deal", label: "Got a better deal" },
  { value: "ordered_by_mistake", label: "Ordered by mistake" },
  { value: "delivery_too_long", label: "Delivery taking too long" },
  { value: "other", label: "Other" },
];

type CancelDialog =
  | { kind: "confirm" }
  | { kind: "feedback"; showRefundNote: boolean }
  | null;

function dollarsFromCents(cents: number | undefined, fallbackDollars: number | undefined): number {
  if (typeof cents === "number") return cents / 100;
  return Number(fallbackDollars ?? 0);
}

function OrderBillBreakdown({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const itemTotal = dollarsFromCents(order.subtotalCents, order.subtotal);
  const productDiscount = dollarsFromCents(order.productDiscountCents, 0);
  const scratchDiscount = dollarsFromCents(order.scratchDiscountCents, 0);
  const couponDiscount = dollarsFromCents(
    order.couponDiscountCents ?? order.coupon?.amountCents,
    order.coupon?.amount ?? order.discount,
  );
  const discountTotal =
    typeof order.productDiscountCents === "number" ||
    typeof order.scratchDiscountCents === "number" ||
    typeof order.couponDiscountCents === "number"
      ? productDiscount + scratchDiscount + couponDiscount
      : Number(order.discount ?? 0);
  const delivery = dollarsFromCents(order.deliveryFeeCents, order.shippingFee);
  const platformFee = dollarsFromCents(order.platformFeeCents, 0);
  const handlingFee = dollarsFromCents(order.handlingFeeCents, 0);
  const tax = dollarsFromCents(order.taxCents, order.tax);
  const total = dollarsFromCents(order.totalCents, order.total);
  const taxLabel = order.taxSnapshot?.jurisdiction ? `Tax (${order.taxSnapshot.jurisdiction})` : "Tax";
  const paymentLabel =
    order.paymentMethod === "cod"
      ? "Cash on delivery"
      : order.paymentMethod === "square"
        ? "Paid by card"
        : order.paymentMethod.replace(/_/g, " ");

  return (
    <section className="rounded-card border border-yd-border bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="block font-semibold text-yd-ink">View bill</span>
          <span className="mt-0.5 block text-sm text-yd-muted">
            Total {formatCad(total)} · {paymentLabel}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-yd-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="border-t border-yd-border px-4 py-3">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-yd-muted">Item total</dt>
              <dd className="font-medium text-yd-ink">{formatCad(itemTotal)}</dd>
            </div>
            {discountTotal > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-yd-muted">
                  Discount
                  {order.coupon?.code ? ` (${order.coupon.code})` : ""}
                </dt>
                <dd className="font-medium text-yd-green">−{formatCad(discountTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-yd-muted">Delivery</dt>
              <dd className="font-medium text-yd-ink">{formatCad(delivery)}</dd>
            </div>
            {platformFee > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-yd-muted">Platform fee</dt>
                <dd className="font-medium text-yd-ink">{formatCad(platformFee)}</dd>
              </div>
            ) : null}
            {handlingFee > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-yd-muted">Handling</dt>
                <dd className="font-medium text-yd-ink">{formatCad(handlingFee)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-yd-muted">{taxLabel}</dt>
              <dd className="font-medium text-yd-ink">{formatCad(tax)}</dd>
            </div>
            {order.taxSnapshot?.components?.length ? (
              <div className="space-y-1 pl-2 text-xs text-yd-muted">
                {order.taxSnapshot.components.map((component) => (
                  <div key={`${component.type}-${component.taxAmountCents}`} className="flex justify-between gap-4">
                    <dt>{component.type.toUpperCase()}</dt>
                    <dd>{formatCad(component.taxAmountCents / 100)}</dd>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-yd-border pt-2 text-base font-semibold text-yd-ink">
              <dt>Total</dt>
              <dd>{formatCad(total)}</dd>
            </div>
            <div className="flex justify-between gap-4 pt-1 text-xs text-yd-muted">
              <dt>Payment</dt>
              <dd className="capitalize">
                {paymentLabel} · {order.paymentStatus}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}

const TRACK: OrderStatus[] = ["pending", "confirmed", "packed", "out_for_delivery", "delivered"];

const TRACK_LABEL: Record<string, string> = {
  pending: "Order Placed",
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
                    {new Date(order.createdAt).toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" })} · {formatCad(order.total)}
                  </p>
                </div>
                <Badge tone={statusTone(order.orderStatus)}>
                  {TRACK_LABEL[order.orderStatus] || order.orderStatus.replace(/_/g, " ")}
                </Badge>
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
  const [cancelDialog, setCancelDialog] = useState<CancelDialog>(null);
  const [cancelReason, setCancelReason] = useState<CancellationReason | "">("");
  const [betterDealDetails, setBetterDealDetails] = useState("");
  const query = useQuery({ queryKey: ["order", id], queryFn: () => ordersApi.get(id), enabled: Boolean(id) });
  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(id),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["order", id] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      const cancelled = result.data;
      const showRefundNote =
        cancelled.paymentMethod !== "cod" &&
        (cancelled.paymentStatus === "refunded" || cancelled.paymentStatus === "paid");
      setCancelDialog({ kind: "feedback", showRefundNote });
    },
    onError: (error) => {
      setCancelDialog(null);
      toast(error instanceof ApiError ? error.message : "Cannot cancel", "error");
    },
  });
  const feedback = useMutation({
    mutationFn: () =>
      ordersApi.cancellationFeedback(id, {
        reason: cancelReason as CancellationReason,
        betterDealDetails:
          cancelReason === "better_deal" && betterDealDetails.trim()
            ? betterDealDetails.trim()
            : undefined,
      }),
    onSuccess: async () => {
      toast("Thanks for your feedback");
      setCancelDialog(null);
      setCancelReason("");
      setBetterDealDetails("");
      await queryClient.invalidateQueries({ queryKey: ["order", id] });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not save feedback", "error"),
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
          {TRACK_LABEL[order.orderStatus] || order.orderStatus.replace(/_/g, " ")} · {order.paymentStatus} · {formatCad(order.total)}
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

      <OrderBillBreakdown order={order} />

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
                {formatCad(item.unitPrice)} × {item.quantity}
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
        <Button variant="danger" loading={cancel.isPending} onClick={() => setCancelDialog({ kind: "confirm" })}>
          Cancel order
        </Button>
      ) : null}

      <ConfirmDialog
        open={cancelDialog?.kind === "confirm"}
        title="Cancel order"
        body="Do you want to cancel this order?"
        confirmLabel="Yes"
        cancelLabel="No"
        confirmPending={cancel.isPending}
        onClose={() => {
          if (!cancel.isPending) setCancelDialog(null);
        }}
        onConfirm={() => cancel.mutate()}
      />

      <Modal
        open={cancelDialog?.kind === "feedback"}
        title="Order cancelled"
        onClose={() => setCancelDialog(null)}
      >
        <p className="text-sm text-yd-ink">Your order has been cancelled successfully.</p>
        {cancelDialog?.kind === "feedback" && cancelDialog.showRefundNote ? (
          <p className="mt-3 text-sm text-yd-muted">
            If any money was debited from your account, it will be refunded within 3–5 business days.
          </p>
        ) : null}
        <p className="mt-4 text-sm font-semibold text-yd-forest">Optional: tell us why you cancelled</p>
        <p className="mt-1 text-xs text-yd-muted">You can skip this step — feedback is not required.</p>
        <div className="mt-3 space-y-2">
          {CANCEL_REASONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-[12px] border p-3 text-sm ${
                cancelReason === option.value ? "border-yd-green bg-yd-green/5" : "border-yd-border"
              }`}
            >
              <input
                type="radio"
                name="cancel-reason"
                className="mt-0.5 accent-yd-green"
                checked={cancelReason === option.value}
                onChange={() => setCancelReason(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {cancelReason === "better_deal" ? (
          <div className="mt-3">
            <Input
              label="Where did you get the better deal? (optional)"
              value={betterDealDetails}
              onChange={(e) => setBetterDealDetails(e.target.value)}
              placeholder="Store or website name"
            />
          </div>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="sm:flex-1" onClick={() => setCancelDialog(null)}>
            Skip
          </Button>
          <Button
            className="sm:flex-1"
            loading={feedback.isPending}
            disabled={!cancelReason}
            onClick={() => feedback.mutate()}
          >
            Submit feedback
          </Button>
        </div>
      </Modal>

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
