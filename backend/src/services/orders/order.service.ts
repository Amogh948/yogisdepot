import mongoose from "mongoose";
import {
  CANCELLABLE_STATUSES,
  CancellationReason,
  ORDER_STATUSES,
  OrderStatus,
  PAYMENT_METHODS,
  PaymentMethod,
} from "../../config/constants";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../errors/AppError";
import { Address } from "../../models/Address";
import { Cart } from "../../models/Cart";
import { CouponRedemption } from "../../models/CouponRedemption";
import { Order, OrderDocument } from "../../models/Order";
import { Product } from "../../models/Product";
import { Vendor } from "../../models/Vendor";
import { nextOrderNumber } from "../../utils/businessIds";
import { logger } from "../../utils/logger";
import { CAD_CURRENCY } from "../../utils/money";
import { PaymentService } from "../payments/payment.service";
import { SquareProvider } from "../payments/square.provider";
import { couponService } from "../coupons/coupon.service";
import { notificationService } from "../notifications/notification.service";
import { cartService } from "../cart/cart.service";
import { checkoutPricingService } from "../checkout/checkoutPricing.service";
import { deliveryLocationService } from "../delivery/deliveryLocation.service";
import { inventoryReservationService } from "../inventory/inventoryReservation.service";
import { scratchService } from "../scratch/scratch.service";
import { buildPagination, parsePagination } from "../../utils/pagination";

export const orderService = {
  async quote(
    userId: string,
    couponCode?: string,
    options?: {
      scratchRewardId?: string;
      addressId?: string;
      deliverySpeed?: "standard" | "superfast";
    },
  ) {
    let shippingDestination: { country: string; state: string; postalCode?: string } | undefined;
    if (options?.addressId) {
      const address = await Address.findOne({ _id: options.addressId, customerId: userId });
      if (address) {
        shippingDestination = {
          country: address.country,
          state: address.state,
          postalCode: address.postalCode,
        };
      }
    }
    return checkoutPricingService.quote({
      userId,
      couponCode,
      softCouponFailure: true,
      scratchRewardId: options?.scratchRewardId,
      shippingDestination,
      deliverySpeed: options?.deliverySpeed,
    });
  },

  async releaseStock(order: OrderDocument) {
    if (order.items.some((i) => i.skuId)) {
      await inventoryReservationService.releaseForOrder(String(order._id));
      return;
    }
    // Legacy product stock path
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
    }
  },

  async abandonUnpaidCheckouts(userId: string) {
    const pending = await Order.find({
      customerId: userId,
      paymentMethod: "square",
      paymentStatus: { $in: ["pending", "failed"] },
      orderStatus: "pending",
    });
    for (const order of pending) {
      await this.releaseStock(order);
      order.orderStatus = "cancelled";
      order.cancelledAt = new Date();
      order.paymentStatus = "failed";
      await order.save();
    }
  },

  async create(
    userId: string,
    input: {
      addressId: string;
      paymentMethod: PaymentMethod;
      deliverySpeed?: "standard" | "superfast";
      couponCode?: string;
      scratchRewardId?: string;
      notes?: string;
    },
  ) {
    if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
      throw new BadRequestError("Unsupported payment method");
    }
    const address = await Address.findOne({ _id: input.addressId, customerId: userId });
    if (!address) {
      throw new NotFoundError("Shipping address not found");
    }
    await deliveryLocationService.assertDeliverable({
      country: address.country,
      state: address.state,
      city: address.city,
      postalCode: address.postalCode,
    });
    if (input.paymentMethod === "square") {
      await this.abandonUnpaidCheckouts(userId);
    }

    const quote = await checkoutPricingService.quote({
      userId,
      couponCode: input.couponCode,
      scratchRewardId: input.scratchRewardId,
      deliverySpeed: input.deliverySpeed || "standard",
      shippingDestination: {
        country: address.country,
        state: address.state,
        postalCode: address.postalCode,
      },
    });

    const orderNumber = await nextOrderNumber();
    const payment = await PaymentService.createPayment({
      orderNumber,
      amount: quote.totalCents / 100,
      amountCents: quote.totalCents,
      method: input.paymentMethod,
      customerId: userId,
    });

    const paymentStatus =
      input.paymentMethod === "cod" ? "pending" : payment.status === "paid" ? "paid" : "pending";
    // Fulfillment starts as "pending" (Order Placed). Admin advances to confirmed / later stages.
    const orderStatus: OrderStatus = "pending";

    const items = quote.lines.map((line) => ({
      skuId: line.skuId || undefined,
      productId: line.productId,
      vendorId: line.vendorId,
      productName: line.productName,
      variantName: line.variantName,
      skuCode: line.skuCode,
      productImage: line.productImage,
      quantity: line.quantity,
      mrpCents: line.mrpCents,
      unitPriceCents: line.unitPriceCents,
      unitPrice: line.unitPriceCents / 100,
      discountCents: line.lineProductDiscountCents,
      finalUnitPriceCents: line.unitPriceCents,
      totalAmountCents: line.lineTotalCents,
      totalPrice: line.lineTotalCents / 100,
      fulfillmentStatus: orderStatus,
    }));

    const session = await mongoose.startSession();
    let order: OrderDocument | null = null;

    const persist = async (useSession: boolean) => {
      const opts = useSession ? { session } : {};

      const created = await Order.create(
        [
          {
            orderNumber,
            customerId: userId,
            currency: CAD_CURRENCY,
            items,
            subtotalCents: quote.subtotalCents,
            productDiscountCents: quote.productDiscountCents,
            scratchDiscountCents: quote.scratchDiscountCents,
            couponDiscountCents: quote.couponDiscountCents,
            deliveryFeeCents: quote.deliveryFeeCents,
            deliverySpeed: quote.deliverySpeed,
            platformFeeCents: quote.platformFeeCents,
            handlingFeeCents: quote.handlingFeeCents,
            taxCents: quote.taxCents,
            totalCents: quote.totalCents,
            subtotal: quote.subtotal,
            discount: quote.discount,
            shippingFee: quote.shippingFee,
            tax: quote.tax,
            total: quote.total,
            taxSnapshot: quote.taxSnapshot,
            coupon: quote.couponSnapshot
              ? {
                  code: quote.couponSnapshot.code,
                  discountType: quote.couponSnapshot.discountType,
                  discountValue: quote.couponSnapshot.discountValue,
                  amountCents: quote.couponSnapshot.amountCents,
                  amount: quote.couponSnapshot.amountCents / 100,
                }
              : undefined,
            scratchRewardId: quote.scratchRewardId,
            scratchRewardCode: quote.scratchRewardCode,
            shippingAddress: {
              fullName: address.fullName,
              phone: address.phone,
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2,
              city: address.city,
              state: address.state,
              postalCode: address.postalCode,
              country: address.country,
              landmark: address.landmark,
            },
            paymentMethod: input.paymentMethod,
            paymentStatus,
            paymentReference: payment.reference,
            transactionId: payment.reference,
            orderStatus,
            notes: input.notes,
          },
        ],
        useSession ? { session } : {},
      );
      order = created[0];

      for (const line of quote.lines) {
        if (line.skuId) {
          await inventoryReservationService.reserve({
            skuId: line.skuId,
            quantity: line.quantity,
            orderId: order._id,
            orderNumber,
            session: useSession ? session : undefined,
          });
        } else {
          const updated = await Product.findOneAndUpdate(
            { _id: line.productId, stock: { $gte: line.quantity } },
            { $inc: { stock: -line.quantity } },
            { new: true, ...opts },
          );
          if (!updated) {
            throw new BadRequestError(`${line.productName} went out of stock`);
          }
        }
      }

      if (paymentStatus === "paid" || input.paymentMethod === "cod" || input.paymentMethod === "mock_online") {
        // For COD, keep reserved until delivered; for paid online mark sold immediately
        if (paymentStatus === "paid") {
          await inventoryReservationService.markSold(String(order._id), useSession ? session : undefined);
        }
      }

      if (quote.couponSnapshot) {
        const coupon = await couponService.applyCents(
          quote.couponSnapshot.code,
          userId,
          quote.subtotalCents,
        );
        await CouponRedemption.create(
          [{ couponId: coupon.coupon._id, userId, orderId: order._id }],
          useSession ? { session } : {},
        );
        await coupon.coupon.updateOne({ $inc: { usedCount: 1 } }, opts);
      }

      if (quote.scratchRewardId) {
        await scratchService.markRedeemed(quote.scratchRewardId, userId, String(order._id));
      }

      if (input.paymentMethod !== "square") {
        await Cart.findOneAndUpdate({ userId }, { items: [] }, opts);
      }
    };

    try {
      session.startTransaction();
      await persist(true);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction().catch(() => undefined);
      const message = error instanceof Error ? error.message : "";
      if (
        message.includes("Transaction numbers are only allowed on a replica set") ||
        message.includes("replica set")
      ) {
        await persist(false);
      } else {
        session.endSession();
        throw error;
      }
    } finally {
      session.endSession();
    }

    if (!order) {
      throw new BadRequestError("Unable to create order");
    }

    const createdOrder = order as OrderDocument;

    if (input.paymentMethod === "mock_online") {
      const verified = await PaymentService.verifyPayment(
        "mock_online",
        payment.reference,
        quote.totalCents / 100,
      );
      if (verified.success) {
        createdOrder.paymentStatus = "paid";
        // Do not auto-confirm fulfillment — admin sets confirmed explicitly.
        await createdOrder.save();
        await inventoryReservationService.markSold(String(createdOrder._id));
      }
    }

    await notificationService.notify({
      userId,
      type: "order_confirmed",
      title: "Order placed",
      body: `Order ${createdOrder.orderNumber} has been placed successfully.`,
      metadata: { orderId: createdOrder.id },
    });

    const vendorIds = [...new Set(createdOrder.items.map((item) => String(item.vendorId)))];
    const vendors = await Vendor.find({ _id: { $in: vendorIds } });
    await Promise.all(
      vendors.map((vendor) =>
        notificationService.notify({
          userId: vendor.userId,
          type: "order_confirmed",
          title: "New order received",
          body: `Order ${createdOrder.orderNumber} includes items from your store.`,
          metadata: { orderId: createdOrder.id },
        }),
      ),
    );

    return { order: createdOrder, payment };
  },

  async confirmOnlinePayment(
    userId: string,
    orderId: string,
    payload: { sourceId: string; verificationToken?: string },
  ) {
    const order = await this.getForCustomer(userId, orderId);
    if (order.paymentMethod !== "square") {
      throw new BadRequestError("This order is not awaiting a Square payment");
    }
    if (order.orderStatus === "cancelled") {
      throw new BadRequestError("This order is cancelled");
    }
    if (order.paymentStatus === "paid") {
      await Cart.findOneAndUpdate({ userId }, { items: [] });
      return order;
    }
    if (!order.paymentReference) {
      throw new BadRequestError("Payment does not match this order");
    }
    if (!payload.sourceId?.trim()) {
      throw new BadRequestError("Missing payment token");
    }

    // If a prior attempt left a Square payment id, reconcile before charging again.
    if (order.transactionId && order.paymentStatus === "pending") {
      const live = await new SquareProvider().getPayment(order.transactionId);
      if (live) {
        const status = String(live.status || "").toUpperCase();
        if (status === "COMPLETED" || status === "APPROVED") {
          return this.markOrderPaid(order, live.id, userId);
        }
        if (status === "FAILED" || status === "CANCELED" || status === "CANCELLED") {
          order.paymentStatus = "failed";
          await order.save();
          throw new BadRequestError("Payment verification failed");
        }
        // Still pending at Square — do not create a second charge.
        return order;
      }
    }

    const amountCents = order.totalCents ?? Math.round((order.total || 0) * 100);
    const amount = amountCents / 100;
    // Stable key prevents duplicate charges on retries/concurrent verify calls.
    const idempotencyKey = `pay_${order.id}`;
    const verified = await PaymentService.verifyPayment("square", order.paymentReference, amount, {
      sourceId: payload.sourceId,
      verificationToken: payload.verificationToken,
      idempotencyKey,
      orderId: order.orderNumber,
      amountCents,
      currency: order.currency || CAD_CURRENCY,
    });
    if (!verified.success) {
      order.paymentStatus = "failed";
      await order.save();
      throw new BadRequestError("Payment verification failed");
    }
    if (verified.status === "pending") {
      // Uncertain or not-final Square state — never treat as paid until COMPLETED/APPROVED.
      if (verified.reference) {
        order.transactionId = verified.reference;
      }
      order.paymentStatus = "pending";
      await order.save();
      await Cart.findOneAndUpdate({ userId }, { items: [] });
      return order;
    }
    return this.markOrderPaid(order, verified.reference, userId);
  },

  async markOrderPaid(order: OrderDocument, squarePaymentId: string, userId?: string) {
    if (order.paymentStatus === "paid") {
      if (userId) await Cart.findOneAndUpdate({ userId }, { items: [] });
      return order;
    }
    order.paymentStatus = "paid";
    order.transactionId = squarePaymentId;
    // Payment success does not advance fulfillment. Leave orderStatus as "pending"
    // (Order Placed); only admin updates move it to confirmed / later stages.
    await order.save();
    await inventoryReservationService.markSold(String(order._id));
    const customerId = userId || String(order.customerId);
    await Cart.findOneAndUpdate({ userId: customerId }, { items: [] });
    return order;
  },

  /** Idempotent webhook path: match by Square payment id or our local payment reference. */
  async markPaidFromSquareWebhook(input: { paymentId?: string; referenceId?: string; status?: string }) {
    const status = String(input.status || "").toUpperCase();
    if (status && status !== "COMPLETED" && status !== "APPROVED") {
      return null;
    }
    if (!input.paymentId && !input.referenceId) {
      return null;
    }
    const order = await Order.findOne({
      paymentMethod: "square",
      $or: [
        ...(input.paymentId ? [{ transactionId: input.paymentId }, { paymentReference: input.paymentId }] : []),
        ...(input.referenceId ? [{ paymentReference: input.referenceId }] : []),
      ],
    });
    if (!order) {
      return null;
    }
    if (order.paymentStatus === "paid") {
      return order;
    }
    if (!input.paymentId) {
      return null;
    }
    return this.markOrderPaid(order, input.paymentId);
  },

  async listForCustomer(userId: string, query: { page?: number; limit?: number }) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { customerId: userId };
    const [data, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);
    return { data, pagination: buildPagination(page, limit, total) };
  },

  async getForCustomer(userId: string, id: string) {
    const order = await Order.findOne({ _id: id, customerId: userId });
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    return order;
  },

  async cancel(userId: string, id: string) {
    const order = await this.getForCustomer(userId, id);
    if (!CANCELLABLE_STATUSES.includes(order.orderStatus)) {
      throw new BadRequestError("This order can no longer be cancelled");
    }
    const wasUnpaid = order.paymentStatus !== "paid";
    let refundSucceeded = false;

    // Attempt provider refund before mutating fulfillment so a hard failure can still
    // leave the order cancellable with a soft refund outcome.
    if (order.paymentStatus === "paid") {
      if (order.paymentMethod === "square" || order.paymentMethod === "mock_online") {
        const method = order.paymentMethod;
        const refundRef =
          method === "square" ? order.transactionId || order.paymentReference : order.paymentReference;
        if (refundRef) {
          const amount = order.totalCents ? order.totalCents / 100 : order.total || 0;
          try {
            await PaymentService.refundPayment(method, refundRef, amount);
            refundSucceeded = true;
          } catch (error) {
            logger.warn("Order cancel refund failed; cancelling order anyway", {
              orderId: String(order._id),
              orderNumber: order.orderNumber,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } else {
          logger.warn("Order cancel skipped refund — missing payment reference", {
            orderId: String(order._id),
            orderNumber: order.orderNumber,
          });
        }
      } else {
        // COD paid is unexpected; treat cancel as refunded locally.
        refundSucceeded = true;
      }
    }

    await this.releaseStock(order);
    order.orderStatus = "cancelled";
    order.cancelledAt = new Date();
    if (order.paymentStatus === "paid") {
      // Only claim refunded when the provider accepted the refund (or local COD path).
      order.paymentStatus = refundSucceeded ? "refunded" : "paid";
    } else {
      order.paymentStatus = "failed";
    }
    await order.save();
    if (wasUnpaid) {
      await cartService.restoreIfEmpty(
        userId,
        order.items.map((item) => ({
          skuId: item.skuId,
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
    }
    await notificationService.notify({
      userId,
      type: "order_cancelled",
      title: "Order cancelled",
      body: `Order ${order.orderNumber} was cancelled.`,
    });
    return order;
  },

  async submitCancellationFeedback(
    userId: string,
    id: string,
    input: { reason: CancellationReason; betterDealDetails?: string },
  ) {
    const order = await this.getForCustomer(userId, id);
    if (order.orderStatus !== "cancelled") {
      throw new BadRequestError("Feedback can only be submitted for a cancelled order");
    }
    order.cancellationReason = input.reason;
    if (input.reason === "better_deal" && input.betterDealDetails?.trim()) {
      order.cancellationBetterDealDetails = input.betterDealDetails.trim();
    } else {
      order.cancellationBetterDealDetails = undefined;
    }
    order.cancellationFeedbackAt = new Date();
    await order.save();
    return order;
  },

  async listAll(query: { page?: number; limit?: number; status?: string; search?: string }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.orderStatus = query.status;
    if (query.search) filter.orderNumber = { $regex: query.search, $options: "i" };
    const [data, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("customerId", "firstName lastName email"),
      Order.countDocuments(filter),
    ]);
    return { data, pagination: buildPagination(page, limit, total) };
  },

  async listForVendor(vendorId: string, query: { page?: number; limit?: number; status?: string }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { "items.vendorId": vendorId };
    if (query.status) filter["items.fulfillmentStatus"] = query.status;
    const [data, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);
    const scoped = data.map((order) => {
      const json = order.toJSON() as unknown as OrderDocument & { items: OrderDocument["items"] };
      json.items = order.items.filter((item) => String(item.vendorId) === vendorId);
      return json;
    });
    return { data: scoped, pagination: buildPagination(page, limit, total) };
  },

  async getById(id: string) {
    const order = await Order.findById(id).populate("customerId", "firstName lastName email phone");
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    return order;
  },

  async updateStatus(id: string, status: OrderStatus) {
    if (!ORDER_STATUSES.includes(status)) {
      throw new BadRequestError("Invalid order status");
    }
    const order = await Order.findById(id);
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    order.orderStatus = status;
    order.items = order.items.map((item) => {
      item.fulfillmentStatus = status;
      return item;
    });
    if (status === "delivered" && order.paymentMethod === "cod") {
      order.paymentStatus = "paid";
      await inventoryReservationService.markSold(String(order._id));
    }
    await order.save();
    const notifyType =
      status === "shipped" || status === "out_for_delivery"
        ? "order_shipped"
        : status === "delivered"
          ? "order_delivered"
          : status === "cancelled"
            ? "order_cancelled"
            : "order_confirmed";
    await notificationService.notify({
      userId: order.customerId,
      type: notifyType,
      title: `Order ${status.replace(/_/g, " ")}`,
      body: `Order ${order.orderNumber} is now ${status.replace(/_/g, " ")}.`,
      metadata: { orderId: order.id },
    });
    return order;
  },

  async updateVendorFulfillment(orderId: string, vendorId: string, status: OrderStatus) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    const ownsItems = order.items.some((item) => String(item.vendorId) === vendorId);
    if (!ownsItems) {
      throw new ForbiddenError("This order does not contain your products");
    }
    order.items = order.items.map((item) => {
      if (String(item.vendorId) === vendorId) {
        item.fulfillmentStatus = status;
      }
      return item;
    });
    const statuses = order.items.map((item) => item.fulfillmentStatus);
    const allSame = statuses.every((value) => value === statuses[0]);
    if (allSame) {
      order.orderStatus = statuses[0];
    } else if (statuses.includes("shipped") || statuses.includes("out_for_delivery")) {
      order.orderStatus = "processing";
    }
    await order.save();
    return order;
  },
};
