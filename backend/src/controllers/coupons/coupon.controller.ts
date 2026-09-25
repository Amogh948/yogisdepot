import { Request, Response } from "express";
import { couponService } from "../../services/coupons/coupon.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const couponController = {
  validate: asyncHandler(async (req: Request, res: Response) => {
    const applied = await couponService.apply(req.body.code, req.user!.id, req.body.subtotal ?? 0);
    sendSuccess(
      res,
      {
        code: applied.coupon.couponCode,
        discountType: applied.coupon.discountType,
        discountValue: applied.coupon.discountValue,
        amount: applied.amount,
      },
      "Coupon applied",
    );
  }),
};

export const adminCouponController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await couponService.list(req.query);
    sendSuccess(res, result.data, "Coupons fetched successfully", 200, result.pagination);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const coupon = await couponService.create(req.body);
    sendSuccess(res, coupon, "Coupon created successfully", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const coupon = await couponService.update(req.params.id, req.body);
    sendSuccess(res, coupon, "Coupon updated successfully");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const coupon = await couponService.remove(req.params.id);
    sendSuccess(res, coupon, "Coupon deactivated successfully");
  }),
};
