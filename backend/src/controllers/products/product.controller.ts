import { Request, Response } from "express";
import { ProductDocument } from "../../models/Product";
import { productService } from "../../services/products/product.service";
import { skuOfferService } from "../../services/catalog/skuOffer.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { assertVendorId } from "../vendor/vendor.controller";

function normalizeImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => {
      if (typeof img === "string") return img;
      if (img && typeof img === "object" && "url" in img) {
        return String((img as { url?: string }).url || "");
      }
      return "";
    })
    .filter(Boolean);
}

export async function toPublicProduct(product: ProductDocument) {
  const json = product.toJSON() as Record<string, unknown>;
  delete json.costPrice;
  const offers = await skuOfferService.offersForProduct(product);
  const primary = offers[0];
  if (primary) {
    json.price = primary.price;
    json.compareAtPrice = primary.compareAtPrice;
    json.mrpCents = primary.mrpCents;
    json.sellingPriceCents = primary.sellingPriceCents;
    json.discountCents = primary.discountCents;
    json.discountPercentage = primary.discountPercentage;
    json.skuId = primary.skuId || undefined;
    json.available = primary.available;
    json.stock = primary.availableQuantity;
    if (primary.images.length) {
      json.images = primary.images;
      json.thumbnail = primary.images[0];
    }
  }
  // Always expose string URLs for storefront cards (related/list may omit images select).
  const urls = normalizeImageUrls(json.images);
  json.images = urls;
  if (!json.thumbnail && urls[0]) {
    json.thumbnail = urls[0];
  }
  json.offers = offers.map((o) => {
    const { costPriceCents: _c, ...rest } = o as typeof o & { costPriceCents?: number };
    return rest;
  });
  json.currency = "CAD";
  return json;
}

export const productController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await productService.list(req.query);
    const data = await Promise.all(result.data.map((p) => toPublicProduct(p)));
    sendSuccess(res, data, "Products fetched successfully", 200, result.pagination);
  }),

  getBySlug: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.getBySlug(req.params.slug);
    sendSuccess(res, await toPublicProduct(product), "Product fetched successfully");
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.getById(req.params.id);
    sendSuccess(res, await toPublicProduct(product), "Product fetched successfully");
  }),

  related: asyncHandler(async (req: Request, res: Response) => {
    const products = await productService.related(req.params.id);
    const data = await Promise.all(products.map((p) => toPublicProduct(p as ProductDocument)));
    sendSuccess(res, data, "Related products fetched successfully");
  }),
};

export const vendorProductController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const result = await productService.list(req.query, { vendorScope: vendorId, includeInactive: true });
    sendSuccess(res, result.data, "Products fetched successfully", 200, result.pagination);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const product = await productService.create({ ...req.body, vendorId });
    sendSuccess(res, product, "Product created successfully", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const product = await productService.update(req.params.id, req.body, vendorId);
    sendSuccess(res, product, "Product updated successfully");
  }),

  setStatus: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const product = await productService.setStatus(req.params.id, req.body.isActive, vendorId);
    sendSuccess(res, product, "Product status updated successfully");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const product = await productService.remove(req.params.id, vendorId);
    sendSuccess(res, product, "Product deleted successfully");
  }),

  adjustInventory: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const product = await productService.adjustInventory(
      req.params.id,
      vendorId,
      req.body.type,
      req.body.quantity,
      req.body.reason,
    );
    sendSuccess(res, product, "Inventory updated successfully");
  }),

  inventoryHistory: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const history = await productService.inventoryHistory(req.params.id, vendorId);
    sendSuccess(res, history, "Inventory history fetched successfully");
  }),
};

export const adminProductController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await productService.list(req.query, { includeInactive: true });
    sendSuccess(res, result.data, "Products fetched successfully", 200, result.pagination);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.create(req.body);
    sendSuccess(res, product, "Product created successfully", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.update(req.params.id, req.body);
    sendSuccess(res, product, "Product updated successfully");
  }),

  setStatus: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.setStatus(req.params.id, req.body.isActive);
    sendSuccess(res, product, "Product status updated successfully");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.remove(req.params.id);
    sendSuccess(res, product, "Product deleted successfully");
  }),
};
