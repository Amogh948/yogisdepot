import { Request, Response } from "express";
import { z } from "zod";
import { homeSectionService } from "../../services/catalog/homeSection.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { toPublicProduct } from "../products/product.controller";

export const homeSectionUpdateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  subtitle: z.string().trim().max(160).optional().nullable(),
  productIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const adminHomeSectionController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await homeSectionService.listAdmin(), "Home sections fetched");
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await homeSectionService.getAdmin(req.params.keyOrId), "Home section fetched");
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const body = homeSectionUpdateSchema.parse(req.body);
    sendSuccess(res, await homeSectionService.update(req.params.keyOrId, body), "Home section saved");
  }),
};

export const publicHomeSectionController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const rows = await homeSectionService.listPublic();
    const data = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        key: row.key,
        title: row.title,
        subtitle: row.subtitle,
        sortOrder: row.sortOrder,
        products: await Promise.all(row.products.map((p) => toPublicProduct(p))),
      })),
    );
    sendSuccess(res, data, "Home sections fetched");
  }),
};
