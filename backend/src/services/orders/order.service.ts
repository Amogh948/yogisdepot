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
import { InventoryTransaction } from "../../models/InventoryTransaction";
import { Order, OrderDocument } from "../../models/Order";
import { getPlatformSettings } from "../../models/PlatformSettings";
import { Product } from "../../models/Product";
import { Vendor } from "../../models/Vendor";
import { PaymentService } from "../payments/payment.service";
import { couponService } from "../coupons/coupon.service";
import { notificationService } from "../notifications/notification.service";
import { cartService } from "../cart/cart.service";
import { buildPagination, parsePagination } from "../../utils/pagination";

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `YD-${stamp}-${rand}`;
}

export const orderService = {
  async quote(userId: string, couponCode?: string) {
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestError("Your cart is empty");
    }
    const settings = await getPlatformSettings();
    const products = await Product.find({ _id: { $in: cart.items.map((i) => i.productId) } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    let subtotal = 0;
    const lines = cart.items.map((item) => {
      const product = productMap.get(String(item.productId));
      if (!product || !product.isActive) {
        throw new BadRequestError("One or more products are no longer available");
      }
      if (product.stock < item.quantity) {
        throw new BadRequestError(`${product.name} does not have enough stock`);
      }
      const totalPrice = product.price * item.quantity;
      subtotal += totalPrice;
      return { product, quantity: item.quantity, unitPrice: product.price, totalPrice };
    });
    let discount = 0;
    let couponSnapshot: OrderDocument["coupon"];
    if (couponCode) {
      const applied = await couponService.apply(couponCode, userId, subtotal);
      discount = applied.amount;
      couponSnapshot = {
        code: applied.coupon.couponCode,
        discountType: applied.coupon.discountType,
        discountValue: applied.coupon.discountValue,
        amount: applied.amount,
      };
    }
    const taxable = Math.max(0, subtotal - discount);
    const shippingFee = taxable >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
    const tax = Math.round(taxable * settings.taxRate * 100) / 100;
    const total = Math.round((taxable + shippingFee + tax) * 100) / 100;
    return { lines, subtotal, discount, shippingFee, tax, total, couponSnapshot, settings };
  },

  async releaseStock(order: OrderDocument) {
    for (const item of order.items) {
      const updated = await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } }, { new: true });
      if (updated) {
        await InventoryTransaction.create({
          productId: item.productId,
          vendorId: item.vendorId,
          type: "return",
          quantity: item.quantity,
          previousStock: updated.stock - item.quantity,
          newStock: updated.stock,
          reason: `Cancelled ${order.orderNumber}`,
        });
      }
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

  async create(userId: string, input: { addressId: string; paymentMethod: PaymentMethod; couponCode?: string; notes?: string }) {
    if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
      throw new BadRequestError("Unsupported payment method");
    }
    const address = await Address.findOne({ _id: input.addressId, customerId: userId });
    if (!address) {
      throw new NotFoundError("Shipping address not found");
    }
    if (input.paymentMethod === "razorpay") {
      await this.abandonUnpaidCheckouts(userId);
    }
    const quote = await this.quote(userId, input.couponCode);
    const orderNumber = generateOrderNumber();
    const payment = await PaymentService.createPayment({
      orderNumber,
      amount: quote.total,
      method: input.paymentMethod,
      customerId: userId,
    });

    const paymentStatus = input.paymentMethod === "cod" ? "pending" : payment.status === "paid" ? "paid" : "pending";
    const orderStatus: OrderStatus = input.paymentMethod === "mock_online" ? "confirmed" : "pending";

    const items = quote.lines.map((line) => ({
      productId: line.product._id,
      vendorId: line.product.vendorId,
      productName: line.product.name,
      productImage: line.product.thumbnail || line.product.images[0],
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      totalPrice: line.totalPrice,
      fulfillmentStatus: orderStatus,
    }));

    const session = await mongoose.startSession();
    let order: OrderDocument | null = null;

    const persist = async (useSession: boolean) => {
      const opts = useSession ? { session } : {};
      for (const line of quote.lines) {
        const updated = await Product.findOneAndUpdate(
          { _id: line.product._id, stock: { $gte: line.quantity } },
          { $inc: { stock: -line.quantity } },
          { new: true, ...opts },
        );
        if (!updated) {
          throw new BadRequestError(`${line.product.name} went out of stock`);
        }
        await InventoryTransaction.create(
          [
            {
              productId: line.product._id,
              vendorId: line.product.vendorId,
              type: "sale",
              quantity: -line.quantity,
              previousStock: updated.stock + line.quantity,
              newStock: updated.stock,
              reason: `Order ${orderNumber}`,
            },
          ],
          useSession ? { session } : {},
        );
      }

      const created = await Order.create(
        [
          {
            orderNumber,
            customerId: userId,
            items,
            subtotal: quote.subtotal,
            discount: quote.discount,
            shippingFee: quote.shippingFee,
            tax: quote.tax,
            total: quote.total,
            coupon: quote.couponSnapshot,
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
            orderStatus,
            notes: input.notes,
          },
        ],
        useSession ? { session } : {},
      );
      order = created[0];

      if (quote.couponSnapshot) {
        const coupon = await couponService.apply(quote.couponSnapshot.code, userId, quote.subtotal);
        await CouponRedemption.create(
          [{ couponId: coupon.coupon._id, userId, orderId: order._id }],
          useSession ? { session } : {},
        );
        await coupon.coupon.updateOne({ $inc: { usedCount: 1 } }, opts);
      }

      // Keep the cart until Razorpay payment succeeds so abandoning checkout does not delete items.
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
      if (message.includes("Transaction numbers are only allowed on a replica set") || message.includes("replica set")) {
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
      const verified = await PaymentService.verifyPayment("mock_online", payment.reference, quote.total);
      if (verified.success) {
        createdOrder.paymentStatus = "paid";
        createdOrder.orderStatus = "confirmed";
        await createdOrder.save();
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
    const verified = await PaymentService.verifyPayment("razorpay", payload.razorpay_order_id, order.total, {
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
    order.items = order.items.map((item) => {
      item.fulfillmentStatus = "confirmed";
      return item;
    });
    await order.save();
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
        await PaymentService.refundPayment(order.paymentMethod, order.paymentReference, order.total);
      }
    } else {
      order.paymentStatus = "failed";
    }
    await order.save();
    if (wasUnpaid) {
      await cartService.restoreIfEmpty(
        userId,
        order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
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
