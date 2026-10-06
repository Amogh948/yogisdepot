import { Request, Response } from "express";
import { analyticsService } from "../../services/analytics/analytics.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { assertVendorId } from "../vendor/vendor.controller";
import { User } from "../../models/User";
import { Address } from "../../models/Address";
import { getPlatformSettings } from "../../models/PlatformSettings";
import { buildPagination, parsePagination } from "../../utils/pagination";
import { retrieveUploadedFile, saveUploadedFiles } from "../../services/storage/storage.service";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/AppError";
import { ADDRESS_TYPES } from "../../config/constants";
import { z } from "zod";

export const adminCustomerUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  isEmailVerified: z.boolean().optional(),
  defaultAddress: z
    .object({
      id: z.string().optional(),
      fullName: z.string().trim().min(1),
      phone: z.string().trim().min(1),
      addressLine1: z.string().trim().min(1),
      addressLine2: z.string().trim().optional().or(z.literal("")),
      city: z.string().trim().min(1),
      state: z.string().trim().min(1),
      postalCode: z.string().trim().min(1),
      country: z.string().trim().min(1).default("Canada"),
      landmark: z.string().trim().optional().or(z.literal("")),
      addressType: z.enum(ADDRESS_TYPES).optional(),
    })
    .optional()
    .nullable(),
});

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

  get: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findOne({ _id: req.params.id, role: "customer" });
    if (!user) {
      throw new NotFoundError("Customer not found");
    }
    const addresses = await Address.find({ customerId: user._id }).sort({ isDefault: -1, createdAt: -1 });
    sendSuccess(res, { ...user.toJSON(), addresses }, "Customer fetched successfully");
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findOne({ _id: req.params.id, role: "customer" });
    if (!user) {
      throw new NotFoundError("Customer not found");
    }

    const { defaultAddress, ...profile } = req.body as z.infer<typeof adminCustomerUpdateSchema>;

    if (profile.email && profile.email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: profile.email.toLowerCase(), _id: { $ne: user._id } });
      if (existing) {
        throw new ConflictError("An account with this email already exists");
      }
      user.email = profile.email.toLowerCase();
    }
    if (profile.firstName !== undefined) user.firstName = profile.firstName;
    if (profile.lastName !== undefined) user.lastName = profile.lastName;
    if (profile.phone !== undefined) user.phone = profile.phone || undefined;
    if (profile.isActive !== undefined) user.isActive = profile.isActive;
    if (profile.isEmailVerified !== undefined) user.isEmailVerified = profile.isEmailVerified;
    await user.save();

    if (defaultAddress) {
      const payload = {
        fullName: defaultAddress.fullName,
        phone: defaultAddress.phone,
        addressLine1: defaultAddress.addressLine1,
        addressLine2: defaultAddress.addressLine2 || undefined,
        city: defaultAddress.city,
        state: defaultAddress.state,
        postalCode: defaultAddress.postalCode,
        country: defaultAddress.country || "Canada",
        landmark: defaultAddress.landmark || undefined,
        addressType: defaultAddress.addressType || "home",
        isDefault: true,
      };
      await Address.updateMany({ customerId: user._id }, { isDefault: false });
      if (defaultAddress.id) {
        const updated = await Address.findOneAndUpdate(
          { _id: defaultAddress.id, customerId: user._id },
          payload,
          { new: true },
        );
        if (!updated) {
          throw new NotFoundError("Address not found");
        }
      } else {
        const existingDefault = await Address.findOne({ customerId: user._id }).sort({ isDefault: -1, createdAt: -1 });
        if (existingDefault) {
          Object.assign(existingDefault, payload);
          await existingDefault.save();
        } else {
          await Address.create({ ...payload, customerId: user._id });
        }
      }
    }

    const addresses = await Address.find({ customerId: user._id }).sort({ isDefault: -1, createdAt: -1 });
    sendSuccess(res, { ...user.toJSON(), addresses }, "Customer updated successfully");
  }),

  setActive: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "customer" },
      { isActive: req.body.isActive },
      { new: true },
    );
    if (!user) {
      throw new NotFoundError("Customer not found");
    }
    sendSuccess(res, user, "Customer updated successfully");
  }),
};

export const settingsUpdateSchema = z.object({
  siteName: z.string().min(2).optional(),
  currency: z.enum(["CAD", "USD", "INR", "GBP", "EUR", "AUD"]).optional(),
  /** @deprecated Not used for checkout tax */
  taxRate: z.number().min(0).max(1).optional(),
  shippingFee: z.number().min(0).optional(),
  freeShippingThreshold: z.number().min(0).optional(),
  deliveryFeeCents: z.coerce.number().int().min(0).optional(),
  freeShippingThresholdCents: z.coerce.number().int().min(0).optional(),
  platformFeeCents: z.coerce.number().int().min(0).optional(),
  handlingFeeCents: z.coerce.number().int().min(0).optional(),
  smallCartFeeCents: z.coerce.number().int().min(0).optional(),
  smallCartThresholdCents: z.coerce.number().int().min(0).optional(),
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
    // Keep legacy dollar mirrors in sync when cents fields are updated
    if (typeof req.body.deliveryFeeCents === "number") {
      settings.shippingFee = req.body.deliveryFeeCents / 100;
    }
    if (typeof req.body.freeShippingThresholdCents === "number") {
      settings.freeShippingThreshold = req.body.freeShippingThresholdCents / 100;
    }
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
