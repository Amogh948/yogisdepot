import { Request, Response } from "express";
import { z } from "zod";
import { MERCHANDISING_PLACEMENTS } from "../../models/MerchandisingCollection";
import { merchandisingService } from "../../services/catalog/merchandising.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { toPublicProduct } from "../products/product.controller";

export const merchandisingSchema = z.object({
  name: z.string().min(2).max(80),
  subtitle: z.string().max(160).optional(),
  placement: z.enum(MERCHANDISING_PLACEMENTS).optional(),
  image: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  productIds: z.array(z.string()).optional(),
});

export const merchandisingUpdateSchema = merchandisingSchema.partial();

export const productMerchandisingSchema = z.object({
  collectionIds: z.array(z.string()),
});

export const publicMerchandisingController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const placement = z.enum(MERCHANDISING_PLACEMENTS).optional().parse(req.query.placement);
    const rows = await merchandisingService.listPublic(placement);
    const data = await Promise.all(
      rows.map(async (row) => {
        const products = await merchandisingService.productsFor(row.productIds);
        return {
          id: String(row._id),
          name: row.name,
          slug: row.slug,
          subtitle: row.subtitle,
          placement: row.placement,
          image: row.image,
          sortOrder: row.sortOrder,
          products: await Promise.all(products.map((p) => toPublicProduct(p))),
        };
      }),
    );
    sendSuccess(res, data, "Merchandising fetched successfully");
  }),
};

export const adminMerchandisingController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await merchandisingService.listAdmin(), "Merchandising fetched");
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await merchandisingService.getAdmin(req.params.id), "Merchandising fetched");
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const body = merchandisingSchema.parse(req.body);
    sendSuccess(res, await merchandisingService.create(body), "Merchandising created", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const body = merchandisingUpdateSchema.parse(req.body);
    sendSuccess(res, await merchandisingService.update(req.params.id, body), "Merchandising updated");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await merchandisingService.remove(req.params.id);
    sendSuccess(res, null, "Merchandising deleted");
  }),

  forProduct: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await merchandisingService.collectionsForProduct(req.params.id), "Product merchandising fetched");
  }),

  setProduct: asyncHandler(async (req: Request, res: Response) => {
    const body = productMerchandisingSchema.parse(req.body);
    sendSuccess(
      res,
      await merchandisingService.setProductMemberships(req.params.id, body.collectionIds),
      "Product merchandising updated",
    );
  }),
};
