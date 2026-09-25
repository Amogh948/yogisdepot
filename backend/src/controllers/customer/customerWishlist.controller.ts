import { Request, Response } from "express";
import { wishlistService } from "../../services/wishlist/wishlist.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { z } from "zod";

export const wishlistBodySchema = z.object({
  productId: z.string().min(1),
});

export const wishlistController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await wishlistService.list(req.user!.id);
    sendSuccess(res, data, "Wishlist fetched successfully");
  }),

  add: asyncHandler(async (req: Request, res: Response) => {
    const data = await wishlistService.add(req.user!.id, req.body.productId);
    sendSuccess(res, data, "Added to wishlist");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const data = await wishlistService.remove(req.user!.id, req.params.productId);
    sendSuccess(res, data, "Removed from wishlist");
  }),
};
