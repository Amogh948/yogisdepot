import { Request, Response } from "express";
import { ForbiddenError } from "../../errors/AppError";
import { vendorService } from "../../services/vendors/vendor.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const vendorController = {
  apply: asyncHandler(async (req: Request, res: Response) => {
    const vendor = await vendorService.apply(req.user!.id, req.body);
    sendSuccess(res, vendor, "Vendor application submitted", 201);
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const vendor = await vendorService.getMine(req.user!.id);
    sendSuccess(res, vendor, "Vendor profile fetched successfully");
  }),

  updateMe: asyncHandler(async (req: Request, res: Response) => {
    const vendor = await vendorService.updateMine(req.user!.id, req.body);
    sendSuccess(res, vendor, "Vendor profile updated successfully");
  }),

  getPublic: asyncHandler(async (req: Request, res: Response) => {
    const vendor = await vendorService.getBySlug(req.params.slug);
    sendSuccess(res, vendor, "Vendor fetched successfully");
  }),
};

export const adminVendorController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await vendorService.list(req.query);
    sendSuccess(res, result.data, "Vendors fetched successfully", 200, result.pagination);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const vendor = await vendorService.getById(req.params.id);
    sendSuccess(res, vendor, "Vendor fetched successfully");
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const vendor = await vendorService.createByAdmin(req.body);
    sendSuccess(res, vendor, "Vendor created successfully", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const vendor = await vendorService.updateByAdmin(req.params.id, req.body);
    sendSuccess(res, vendor, "Vendor updated successfully");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await vendorService.remove(req.params.id);
    sendSuccess(res, null, "Vendor deleted successfully");
  }),

  setStatus: asyncHandler(async (req: Request, res: Response) => {
    const vendor = await vendorService.setStatus(req.params.id, req.body);
    sendSuccess(res, vendor, "Vendor status updated successfully");
  }),
};

export function assertVendorId(req: Request): string {
  if (!req.user?.vendorId) {
    throw new ForbiddenError("Approved vendor account required");
  }
  return req.user.vendorId;
}
