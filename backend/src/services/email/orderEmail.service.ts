import { OrderStatus } from "../../config/constants";
import { env } from "../../config/env";
import { Order, OrderDocument } from "../../models/Order";
import { getPlatformSettings } from "../../models/PlatformSettings";
import { User } from "../../models/User";
import { logger } from "../../utils/logger";
import { SquareProvider } from "../payments/square.provider";
import { estimatedDeliveryLabel } from "./deliveryEstimate";
import { enqueueEmail, sendEmail } from "./mailer.service";
import {
  buildOrderConfirmationEmail,
  buildOrderStatusEmail,
  type EmailBillInput,
} from "./orderEmail.templates";

/** Fulfillment updates worth an email. Placement itself is the confirmation message, not a status mail. */
const STATUS_EMAILS = new Set<OrderStatus>([
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
]);

export function shouldEmailOrderStatus(status: OrderStatus): boolean {
  return STATUS_EMAILS.has(status);
}

function orderPageUrl(orderId: string): string {
  const base = env.CLIENT_URL.replace(/\/$/, "");
  return `${base}/orders/${orderId}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Fire-and-forget. Payment success must not wait on SMTP. */
export function queueOrderConfirmationEmail(orderId: string): void {
  enqueueEmail(() => deliverOrderConfirmation(orderId));
}

/** Fire-and-forget. An admin status save must not wait on SMTP. */
export function queueOrderStatusEmail(
  orderId: string,
  status: OrderStatus,
  options?: { trackingUpdate?: boolean },
): void {
  if (!shouldEmailOrderStatus(status) && !options?.trackingUpdate) return;
  enqueueEmail(() => deliverOrderStatus(orderId, status));
}

async function customerRecipient(customerId: unknown): Promise<{ email: string; firstName?: string } | null> {
  const user = await User.findById(customerId).select("email firstName");
  const email = user?.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return { email, firstName: user?.firstName };
}

async function cardOnFile(order: OrderDocument): Promise<{ last4?: string; brand?: string }> {
  if (order.paymentMethod !== "square") return {};
  const paymentId = order.transactionId || "";
  if (!paymentId || paymentId.startsWith("sq_") || paymentId.startsWith("mock_")) return {};
  try {
    const payment = await new SquareProvider().getPayment(paymentId);
    if (!payment?.last4) return {};
    return { last4: payment.last4, brand: payment.cardBrand };
  } catch (error) {
    logger.warn("Could not read card details for the order email", { message: errorMessage(error) });
    return {};
  }
}

async function deliveryLabelFor(order: OrderDocument): Promise<string> {
  try {
    const settings = await getPlatformSettings();
    return estimatedDeliveryLabel({
      placedAt: order.createdAt || new Date(),
      postalCode: order.shippingAddress?.postalCode,
      config: {
        enabled: settings.sameDayDeliveryEnabled !== false,
        cutoffTime: settings.sameDayCutoffTime || "16:00",
        timezone: settings.sameDayTimezone || "America/Edmonton",
        weekdays:
          Array.isArray(settings.sameDayWeekdays) && settings.sameDayWeekdays.length
            ? settings.sameDayWeekdays.map(Number)
            : [1, 2, 3, 4, 5, 6],
        postalPrefixes: Array.isArray(settings.sameDayPostalPrefixes) ? settings.sameDayPostalPrefixes : [],
      },
    });
  } catch (error) {
    logger.warn("Could not compute estimated delivery for the order email", { message: errorMessage(error) });
    return "Within 5 days";
  }
}

function billFromOrder(order: OrderDocument): EmailBillInput {
  return {
    subtotalCents: order.subtotalCents || 0,
    productDiscountCents: order.productDiscountCents || 0,
    couponDiscountCents: order.couponDiscountCents || order.coupon?.amountCents || 0,
    couponCode: order.coupon?.code,
    scratchDiscountCents: order.scratchDiscountCents || 0,
    scratchRewardCode: order.scratchRewardCode,
    platformFeeCents: order.platformFeeCents || 0,
    handlingFeeCents: order.handlingFeeCents || 0,
    deliveryFeeCents: order.deliveryFeeCents || 0,
    deliverySpeed: order.deliverySpeed,
    taxCents: order.taxCents || 0,
    taxJurisdiction: order.taxSnapshot?.jurisdiction,
    taxComponents: order.taxSnapshot?.components?.map((component) => ({
      type: component.type,
      taxAmountCents: component.taxAmountCents,
    })),
    totalCents: order.totalCents || 0,
  };
}

async function deliverOrderConfirmation(orderId: string): Promise<void> {
  try {
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        confirmationEmailQueuedAt: { $exists: false },
        paymentStatus: { $in: ["paid", "refunded"] },
      },
      { $set: { confirmationEmailQueuedAt: new Date() } },
    );
    if (!order) return;

    const recipient = await customerRecipient(order.customerId);
    if (!recipient) {
      logger.warn("Order confirmation skipped; the account has no email", { orderId });
      return;
    }

    const [deliveryLabel, card] = await Promise.all([deliveryLabelFor(order), cardOnFile(order)]);
    const message = buildOrderConfirmationEmail({
      orderNumber: order.orderNumber,
      customerName: recipient.firstName,
      items: order.items.map((item) => ({
        name: item.productName,
        variant: item.variantName,
        quantity: item.quantity,
        totalCents: item.totalAmountCents || 0,
      })),
      bill: billFromOrder(order),
      address: order.shippingAddress,
      estimatedDelivery: deliveryLabel,
      paymentMethod: order.paymentMethod,
      cardLast4: card.last4,
      cardBrand: card.brand,
      orderUrl: orderPageUrl(String(order._id)),
    });
    const result = await sendEmail({ to: recipient.email, ...message });
    logger.info("Order confirmation email finished", {
      orderId,
      orderNumber: order.orderNumber,
      result,
    });
  } catch (error) {
    logger.error("Order confirmation email failed", { orderId, message: errorMessage(error) });
  }
}

async function deliverOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  try {
    const order = await Order.findById(orderId);
    if (!order) return;
    const recipient = await customerRecipient(order.customerId);
    if (!recipient) {
      logger.warn("Order status email skipped; the account has no email", { orderId, status });
      return;
    }
    const message = buildOrderStatusEmail({
      orderNumber: order.orderNumber,
      status,
      customerName: recipient.firstName,
      orderUrl: orderPageUrl(String(order._id)),
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
    });
    const result = await sendEmail({ to: recipient.email, ...message });
    logger.info("Order status email finished", {
      orderId,
      orderNumber: order.orderNumber,
      status,
      result,
    });
  } catch (error) {
    logger.error("Order status email failed", { orderId, status, message: errorMessage(error) });
  }
}
