import { Request, Response } from "express";
import { cartService } from "../../services/cart/cart.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const cartController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const cart = await cartService.getHydrated(req.user!.id);
    sendSuccess(res, cart, "Cart fetched successfully");
  }),

  add: asyncHandler(async (req: Request, res: Response) => {
    const cart = await cartService.addItem(req.user!.id, req.body.productId, req.body.quantity);
    sendSuccess(res, cart, "Product added to cart");
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const cart = await cartService.updateItem(req.user!.id, req.params.productId, req.body.quantity);
    sendSuccess(res, cart, "Cart updated successfully");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const cart = await cartService.removeItem(req.user!.id, req.params.productId);
    sendSuccess(res, cart, "Item removed from cart");
  }),

  clear: asyncHandler(async (req: Request, res: Response) => {
    const cart = await cartService.clear(req.user!.id);
    sendSuccess(res, cart, "Cart cleared");
  }),
};
