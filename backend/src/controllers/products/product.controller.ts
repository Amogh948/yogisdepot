import { Request, Response } from "express";
import { Product, ProductDocument } from "../../models/Product";
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
  json.unlimitedQuantity = product.unlimitedQuantity !== false;
  json.returnWindowDays = Math.max(0, Number(product.returnWindowDays ?? 0));
  json.deliveryEstimateDays = Math.max(1, Number(product.deliveryEstimateDays ?? 5));
  return json;
}

async function attachChildProductSummaries(products: ProductDocument[], jsons: Record<string, unknown>[]) {
  const ids = new Set<string>();
  for (const product of products) {
    for (const link of product.childProducts || []) {
      if (link?.productId) ids.add(String(link.productId));
    }
  }
  const children = ids.size
    ? await Product.find({ _id: { $in: [...ids] } }).select("name price thumbnail images")
    : [];
  const byId = new Map(children.map((child) => [String(child._id), child]));
  return jsons.map((json, index) => {
    const product = products[index];
    const links = product?.childProducts || [];
    json.sellIndependently = product?.sellIndependently !== false;
    json.addChildPricesToParent = product?.addChildPricesToParent !== false;
    json.childProducts = links.map((link) => {
      const child = byId.get(String(link.productId));
      const firstImage = child?.images?.[0];
      const image =
        child?.thumbnail ||
        (firstImage && typeof firstImage === "object" && "url" in firstImage ? String(firstImage.url || "") : undefined);
      return {
        productId: String(link.productId),
        quantity: Math.max(1, Number(link.quantity) || 1),
        name: child?.name || "Included item",
        price: child?.price ?? 0,
        image: image || undefined,
      };
    });
    return json;
  });
}

export const productController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await productService.list(req.query);
    const jsons = await Promise.all(result.data.map((p) => toPublicProduct(p)));
    const data = await attachChildProductSummaries(result.data, jsons);
    sendSuccess(res, data, "Products fetched successfully", 200, result.pagination);
  }),

  getBySlug: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.getBySlug(req.params.slug);
    const [data] = await attachChildProductSummaries([product], [await toPublicProduct(product)]);
    sendSuccess(res, data, "Product fetched successfully");
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.getById(req.params.id);
    const [data] = await attachChildProductSummaries([product], [await toPublicProduct(product)]);
    sendSuccess(res, data, "Product fetched successfully");
  }),

  related: asyncHandler(async (req: Request, res: Response) => {
    const products = await productService.related(req.params.id);
    const docs = products as ProductDocument[];
    const jsons = await Promise.all(docs.map((p) => toPublicProduct(p)));
    const data = await attachChildProductSummaries(docs, jsons);
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
