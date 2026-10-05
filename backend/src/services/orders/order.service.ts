import mongoose from "mongoose";
import {
  CANCELLABLE_STATUSES,
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
import { CAD_CURRENCY } from "../../utils/money";
import { PaymentService } from "../payments/payment.service";
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
    options?: { scratchRewardId?: string; addressId?: string },
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
      scratchRewardId: options?.scratchRewardId,
      shippingDestination,
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
      paymentMethod: "razorpay",
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
    if (input.paymentMethod === "razorpay") {
      await this.abandonUnpaidCheckouts(userId);
    }

    const quote = await checkoutPricingService.quote({
      userId,
      couponCode: input.couponCode,
      scratchRewardId: input.scratchRewardId,
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
    const orderStatus: OrderStatus = input.paymentMethod === "mock_online" ? "confirmed" : "pending";

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

      if (input.paymentMethod !== "razorpay") {
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
        createdOrder.orderStatus = "confirmed";
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

  async confirmRazorpay(
    userId: string,
    orderId: string,
    payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  ) {
    const order = await this.getForCustomer(userId, orderId);
    if (order.paymentMethod !== "razorpay") {
      throw new BadRequestError("This order is not awaiting a Razorpay payment");
    }
    if (order.paymentStatus === "paid") {
      await Cart.findOneAndUpdate({ userId }, { items: [] });
      return order;
    }
    if (order.paymentReference !== payload.razorpay_order_id) {
      throw new BadRequestError("Payment does not match this order");
    }
    const amount = order.totalCents ? order.totalCents / 100 : order.total || 0;
    const verified = await PaymentService.verifyPayment("razorpay", payload.razorpay_order_id, amount, {
      paymentId: payload.razorpay_payment_id,
      signature: payload.razorpay_signature,
    });
    if (!verified.success) {
      order.paymentStatus = "failed";
      await order.save();
      throw new BadRequestError("Payment verification failed");
    }
    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    order.transactionId = payload.razorpay_payment_id;
    order.items = order.items.map((item) => {
      item.fulfillmentStatus = "confirmed";
      return item;
    });
    await order.save();
    await inventoryReservationService.markSold(String(order._id));
    await Cart.findOneAndUpdate({ userId }, { items: [] });
    return order;
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
    await this.releaseStock(order);
    order.orderStatus = "cancelled";
    order.cancelledAt = new Date();
    if (order.paymentStatus === "paid") {
      order.paymentStatus = "refunded";
      if (order.paymentReference) {
        const amount = order.totalCents ? order.totalCents / 100 : order.total || 0;
        await PaymentService.refundPayment(order.paymentMethod, order.paymentReference, amount);
      }
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
