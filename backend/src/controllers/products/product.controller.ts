import { Request, Response } from "express";
import { productService } from "../../services/products/product.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { assertVendorId } from "../vendor/vendor.controller";

export const productController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await productService.list(req.query);
    sendSuccess(res, result.data, "Products fetched successfully", 200, result.pagination);
  }),

  getBySlug: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.getBySlug(req.params.slug);
    sendSuccess(res, product, "Product fetched successfully");
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.getById(req.params.id);
    sendSuccess(res, product, "Product fetched successfully");
  }),

  related: asyncHandler(async (req: Request, res: Response) => {
    const products = await productService.related(req.params.id);
    sendSuccess(res, products, "Related products fetched successfully");
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
    sendSuccess(res, product, "Product deactivated successfully");
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
    sendSuccess(res, product, "Product deactivated successfully");
  }),
};
