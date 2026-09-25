import { Request, Response } from "express";
import { addressService } from "../../services/addresses/address.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const addressController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await addressService.list(req.user!.id);
    sendSuccess(res, data, "Addresses fetched successfully");
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const address = await addressService.create(req.user!.id, req.body);
    sendSuccess(res, address, "Address saved successfully", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const address = await addressService.update(req.user!.id, req.params.id, req.body);
    sendSuccess(res, address, "Address updated successfully");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await addressService.remove(req.user!.id, req.params.id);
    sendSuccess(res, null, "Address deleted successfully");
  }),
};
