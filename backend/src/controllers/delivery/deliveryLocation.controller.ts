import { Request, Response } from "express";
import { z } from "zod";
import { CA_PROVINCES } from "../../models/CanadianTaxRate";
import { deliveryLocationService } from "../../services/delivery/deliveryLocation.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const deliveryLocationSchema = z.object({
  name: z.string().min(2).max(80),
  country: z.string().optional(),
  province: z.enum(CA_PROVINCES),
  city: z.string().max(80).optional().or(z.literal("")),
  postalCodePrefix: z.string().max(10).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const deliveryLocationUpdateSchema = deliveryLocationSchema.partial();

export const deliveryCheckSchema = z.object({
  country: z.string().min(2),
  state: z.string().min(1),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  addressId: z.string().optional(),
});

export const adminDeliveryLocationController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await deliveryLocationService.listAdmin(), "Delivery locations fetched");
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await deliveryLocationService.get(req.params.id), "Delivery location fetched");
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const body = deliveryLocationSchema.parse(req.body);
    sendSuccess(res, await deliveryLocationService.create(body), "Delivery location created", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const body = deliveryLocationUpdateSchema.parse(req.body);
    sendSuccess(res, await deliveryLocationService.update(req.params.id, body), "Delivery location updated");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await deliveryLocationService.remove(req.params.id);
    sendSuccess(res, null, "Delivery location deleted");
  }),
};

export const publicDeliveryLocationController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await deliveryLocationService.listActive(), "Delivery locations fetched");
  }),

  check: asyncHandler(async (req: Request, res: Response) => {
    const body = deliveryCheckSchema.parse(req.body);
    const result = await deliveryLocationService.checkDeliverable({
      country: body.country,
      state: body.state,
      city: body.city,
      postalCode: body.postalCode,
    });
    sendSuccess(res, result, result.deliverable ? "Location is deliverable" : "Location is undeliverable");
  }),
};
