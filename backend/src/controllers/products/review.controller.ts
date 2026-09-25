import { Request, Response } from "express";
import { reviewService } from "../../services/reviews/review.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const reviewController = {
  listForProduct: asyncHandler(async (req: Request, res: Response) => {
    const result = await reviewService.listForProduct(req.params.productId, req.query);
    sendSuccess(res, result.data, "Reviews fetched successfully", 200, result.pagination);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const review = await reviewService.create(req.user!.id, req.body);
    sendSuccess(res, review, "Review submitted successfully", 201);
  }),

  mine: asyncHandler(async (req: Request, res: Response) => {
    const data = await reviewService.listMine(req.user!.id);
    sendSuccess(res, data, "Reviews fetched successfully");
  }),
};

export const adminReviewController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await reviewService.listAll(req.query);
    sendSuccess(res, result.data, "Reviews fetched successfully", 200, result.pagination);
  }),

  moderate: asyncHandler(async (req: Request, res: Response) => {
    const review = await reviewService.moderate(req.params.id, req.body.isApproved);
    sendSuccess(res, review, "Review updated successfully");
  }),
};
