import { Request, Response } from "express";
import { orderService } from "../../services/orders/order.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { assertVendorId } from "../vendor/vendor.controller";

export const customerOrderController = {
  quote: asyncHandler(async (req: Request, res: Response) => {
    const quote = await orderService.quote(req.user!.id, req.query.coupon as string | undefined);
    sendSuccess(res, quote, "Order quote calculated");
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const result = await orderService.create(req.user!.id, req.body);
    sendSuccess(res, result, "Order placed successfully", 201);
  }),

  verifyPayment: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.confirmRazorpay(req.user!.id, req.params.id, req.body);
    sendSuccess(res, order, "Payment verified successfully");
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await orderService.listForCustomer(req.user!.id, req.query);
    sendSuccess(res, result.data, "Orders fetched successfully", 200, result.pagination);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.getForCustomer(req.user!.id, req.params.id);
    sendSuccess(res, order, "Order fetched successfully");
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.cancel(req.user!.id, req.params.id);
    sendSuccess(res, order, "Order cancelled successfully");
  }),
};

export const vendorOrderController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const result = await orderService.listForVendor(vendorId, req.query);
    sendSuccess(res, result.data, "Orders fetched successfully", 200, result.pagination);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const order = await orderService.getById(req.params.id);
    const items = order.items.filter((item) => String(item.vendorId) === vendorId);
    sendSuccess(res, { ...order.toJSON(), items }, "Order fetched successfully");
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const order = await orderService.updateVendorFulfillment(req.params.id, vendorId, req.body.status);
    sendSuccess(res, order, "Fulfillment status updated");
  }),
};

export const adminOrderController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await orderService.listAll(req.query);
    sendSuccess(res, result.data, "Orders fetched successfully", 200, result.pagination);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.getById(req.params.id);
    sendSuccess(res, order, "Order fetched successfully");
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.updateStatus(req.params.id, req.body.status);
    sendSuccess(res, order, "Order status updated");
  }),
};
