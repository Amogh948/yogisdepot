import type { Order, OrderStatus } from "../types";

/** Customer may cancel immediately only while Order Placed. */
export const CANCELLABLE_STATUSES: OrderStatus[] = ["pending"];

/** Customer may request a refund (admin approval) for these fulfillment stages. */
export const REFUND_REQUESTABLE_STATUSES: OrderStatus[] = [
  "confirmed",
  "processing",
  "packed",
  "shipped",
];

/** No cancel / refund request once out for delivery or later. */
export const CANCEL_BLOCKED_STATUSES: OrderStatus[] = ["out_for_delivery", "delivered"];

export const CANCEL_BLOCKED_MESSAGE =
  "Your order is already out for delivery and is on its way; hence, it cannot be cancelled.";

export type CustomerOrderAction =
  | { kind: "cancel" }
  | { kind: "request_refund" }
  | { kind: "refund_pending" }
  | { kind: "blocked"; message: string }
  | { kind: "none" };

export function getCustomerOrderAction(order: Pick<Order, "orderStatus" | "refundRequestStatus">): CustomerOrderAction {
  if (order.orderStatus === "cancelled" || order.orderStatus === "returned" || order.orderStatus === "refunded") {
    return { kind: "none" };
  }
  if (order.refundRequestStatus === "requested") {
    return { kind: "refund_pending" };
  }
  if (CANCEL_BLOCKED_STATUSES.includes(order.orderStatus)) {
    return { kind: "blocked", message: CANCEL_BLOCKED_MESSAGE };
  }
  if (CANCELLABLE_STATUSES.includes(order.orderStatus)) {
    return { kind: "cancel" };
  }
  if (REFUND_REQUESTABLE_STATUSES.includes(order.orderStatus)) {
    return { kind: "request_refund" };
  }
  return { kind: "none" };
}
