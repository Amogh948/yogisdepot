import { Request, Response } from "express";
import { analyticsService } from "../../services/analytics/analytics.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { assertVendorId } from "../vendor/vendor.controller";
import { User } from "../../models/User";
import { getPlatformSettings } from "../../models/PlatformSettings";
import { buildPagination, parsePagination } from "../../utils/pagination";
import { retrieveUploadedFile, saveUploadedFiles } from "../../services/storage/storage.service";
import { BadRequestError } from "../../errors/AppError";
import { z } from "zod";

export const adminAnalyticsController = {
  overview: asyncHandler(async (_req: Request, res: Response) => {
    const data = await analyticsService.adminOverview();
    sendSuccess(res, data, "Analytics fetched successfully");
  }),
};

export const vendorAnalyticsController = {
  overview: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const data = await analyticsService.vendorOverview(vendorId);
    sendSuccess(res, data, "Analytics fetched successfully");
  }),
};

export const adminCustomerController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query);
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const filter: Record<string, unknown> = { role: "customer" };
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    const [data, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    sendSuccess(res, data, "Customers fetched successfully", 200, buildPagination(page, limit, total));
  }),

  setActive: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
    sendSuccess(res, user, "Customer updated successfully");
  }),
};

export const settingsUpdateSchema = z.object({
  siteName: z.string().min(2).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  shippingFee: z.number().min(0).optional(),
  freeShippingThreshold: z.number().min(0).optional(),
  supportEmail: z.string().email().optional(),
});

export const adminSettingsController = {
  get: asyncHandler(async (_req: Request, res: Response) => {
    const settings = await getPlatformSettings();
    sendSuccess(res, settings, "Settings fetched successfully");
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const settings = await getPlatformSettings();
    Object.assign(settings, req.body);
    await settings.save();
    sendSuccess(res, settings, "Settings updated successfully");
  }),
};

export const uploadController = {
  upload: asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      throw new BadRequestError("No files uploaded");
    }
    const stored = await saveUploadedFiles(files);
    sendSuccess(res, stored, "Files uploaded successfully", 201);
  }),

  retrieve: asyncHandler(async (req: Request, res: Response) => {
    const publicId = String(req.query.publicId || "");
    if (!publicId) {
      throw new BadRequestError("publicId is required");
    }
    const file = await retrieveUploadedFile(publicId);
    sendSuccess(res, file, "File retrieved successfully");
  }),
};
