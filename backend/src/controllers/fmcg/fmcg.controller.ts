import { Request, Response } from "express";
import { z } from "zod";
import { CanadianTaxRate, CA_PROVINCES, CA_TAX_COMPONENTS } from "../../models/CanadianTaxRate";
import { Inventory } from "../../models/Inventory";
import { InventoryBatch } from "../../models/InventoryBatch";
import { Pricing } from "../../models/Pricing";
import { ScratchCampaign } from "../../models/ScratchCampaign";
import { TaxCategory } from "../../models/TaxCategory";
import { Warehouse } from "../../models/Warehouse";
import { catalogAdminService } from "../../services/catalog/catalogAdmin.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { assertVendorId } from "../vendor/vendor.controller";

const wizardVariantSchema = z.object({
  name: z.string().min(1),
  sizeValue: z.number().optional(),
  sizeUnit: z.string().optional(),
  packQuantity: z.number().int().min(1).optional(),
  packagingType: z.string().optional(),
  barcode: z.string().optional(),
  skuCode: z.string().optional(),
  mrpCents: z.number().int().min(0),
  costPriceCents: z.number().int().min(0),
  sellingPriceCents: z.number().int().min(0),
  taxCategoryId: z.string().optional(),
  availableQuantity: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  batch: z
    .object({
      batchNumber: z.string().min(1),
      manufacturingDate: z.string().optional(),
      expiryDate: z.string().optional(),
      purchasePriceCents: z.number().int().min(0),
      quantity: z.number().int().min(0),
    })
    .optional(),
});

export const productWizardSchema = z.object({
  name: z.string().min(2),
  brandId: z.string().optional(),
  brandName: z.string().optional(),
  categoryId: z.string().min(1).optional(),
  categoryIds: z.array(z.string().min(1)).min(1).optional(),
  vendorId: z.string().min(1).optional(),
  description: z.string().min(2),
  shortDescription: z.string().optional(),
  manufacturer: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  ingredients: z.string().optional(),
  storageInstructions: z.string().optional(),
  usageInstructions: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tasteIndiaRegion: z
    .enum(["north-india", "south-india", "west-india", "east-india", "northeast-india"])
    .optional()
    .nullable(),
  festivalId: z.string().optional().nullable(),
  images: z.array(z.union([z.string(), z.object({ url: z.string(), type: z.string().optional() })])).optional(),
  variants: z.array(wizardVariantSchema).min(1),
}).refine((data) => Boolean(data.categoryIds?.length || data.categoryId), {
  message: "Select at least one category",
  path: ["categoryIds"],
});

const stackVariantUpdateSchema = z.object({
  variantId: z.string().min(1),
  name: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  barcode: z.string().optional(),
  mrpCents: z.number().int().min(0).optional(),
  costPriceCents: z.number().int().min(0).optional(),
  sellingPriceCents: z.number().int().min(0).optional(),
  availableQuantity: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  taxCategoryId: z.string().optional(),
});

export const productStackUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  brandId: z.string().optional(),
  brandName: z.string().optional(),
  categoryId: z.string().min(1).optional(),
  categoryIds: z.array(z.string().min(1)).min(1).optional(),
  vendorId: z.string().min(1).optional(),
  description: z.string().min(2).optional(),
  shortDescription: z.string().optional(),
  manufacturer: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  ingredients: z.string().optional(),
  storageInstructions: z.string().optional(),
  usageInstructions: z.string().optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.union([z.string(), z.object({ url: z.string(), type: z.string().optional() })])).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isVegetarian: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  tasteIndiaRegion: z
    .enum(["north-india", "south-india", "west-india", "east-india", "northeast-india"])
    .optional()
    .nullable(),
  festivalId: z.string().optional().nullable(),
  variants: z.array(stackVariantUpdateSchema).optional(),
});

export const adminFmcgController = {
  createProductWizard: asyncHandler(async (req: Request, res: Response) => {
    const body = productWizardSchema.parse(req.body);
    const product = await catalogAdminService.createProductStack({
      ...body,
      vendorId: body.vendorId!,
      images: body.images as never,
    });
    sendSuccess(res, product, "Product created", 201);
  }),

  getProductStack: asyncHandler(async (req: Request, res: Response) => {
    const product = await catalogAdminService.getProductStack(req.params.id);
    sendSuccess(res, product, "Product fetched");
  }),

  updateProductStack: asyncHandler(async (req: Request, res: Response) => {
    const body = productStackUpdateSchema.parse(req.body);
    const product = await catalogAdminService.updateProductStack(req.params.id, {
      ...body,
      images: body.images as never,
    });
    sendSuccess(res, product, "Product updated");
  }),

  brands: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await catalogAdminService.listBrands(), "Brands fetched");
  }),

  createBrand: asyncHandler(async (req: Request, res: Response) => {
    const brand = await catalogAdminService.createBrand(req.body);
    sendSuccess(res, brand, "Brand created", 201);
  }),

  updateBrand: asyncHandler(async (req: Request, res: Response) => {
    const brand = await catalogAdminService.updateBrand(req.params.id, req.body);
    sendSuccess(res, brand, "Brand updated");
  }),

  removeBrand: asyncHandler(async (req: Request, res: Response) => {
    await catalogAdminService.removeBrand(req.params.id);
    sendSuccess(res, null, "Brand deleted");
  }),

  taxCategories: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await catalogAdminService.listTaxCategories(), "Tax categories fetched");
  }),

  createTaxCategory: asyncHandler(async (req: Request, res: Response) => {
    const cat = await TaxCategory.create(req.body);
    sendSuccess(res, cat, "Tax category created", 201);
  }),

  taxRates: asyncHandler(async (_req: Request, res: Response) => {
    const rates = await CanadianTaxRate.find().sort({ province: 1, effectiveFrom: -1 });
    sendSuccess(res, rates, "Tax rates fetched");
  }),

  createTaxRate: asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      province: z.enum(CA_PROVINCES),
      component: z.enum(CA_TAX_COMPONENTS),
      rateBps: z.number().int().min(0).max(10000),
      effectiveFrom: z.coerce.date(),
      effectiveTo: z.coerce.date().nullable().optional(),
      isActive: z.boolean().optional(),
      appliesToAllTaxable: z.boolean().optional(),
      taxCategoryIds: z.array(z.string()).optional(),
    });
    const body = schema.parse(req.body);
    const rate = await CanadianTaxRate.create(body);
    sendSuccess(res, rate, "Tax rate version created", 201);
  }),

  warehouses: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await catalogAdminService.listWarehouses(), "Warehouses fetched");
  }),

  createWarehouse: asyncHandler(async (req: Request, res: Response) => {
    const wh = await Warehouse.create(req.body);
    sendSuccess(res, wh, "Warehouse created", 201);
  }),

  skus: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await catalogAdminService.listSkus(), "SKUs fetched");
  }),

  inventory: asyncHandler(async (_req: Request, res: Response) => {
    const rows = await Inventory.find().sort({ updatedAt: -1 }).limit(500);
    sendSuccess(res, rows, "Inventory fetched");
  }),

  batches: asyncHandler(async (_req: Request, res: Response) => {
    const rows = await InventoryBatch.find().sort({ expiryDate: 1 }).limit(500);
    sendSuccess(res, rows, "Batches fetched");
  }),

  pricing: asyncHandler(async (_req: Request, res: Response) => {
    const rows = await Pricing.find().sort({ updatedAt: -1 }).limit(500);
    sendSuccess(res, rows, "Pricing fetched");
  }),

  scratchCampaigns: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await ScratchCampaign.find().sort({ createdAt: -1 }), "Scratch campaigns fetched");
  }),

  createScratchCampaign: asyncHandler(async (req: Request, res: Response) => {
    const campaign = await ScratchCampaign.create(req.body);
    sendSuccess(res, campaign, "Scratch campaign created", 201);
  }),
};

export const vendorFmcgController = {
  createProduct: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    const body = productWizardSchema.parse({ ...req.body, vendorId });
    const product = await catalogAdminService.createProductStack(
      { ...body, vendorId, images: body.images as never },
      { asVendorId: vendorId },
    );
    sendSuccess(res, product, "Product created", 201);
  }),

  skus: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = assertVendorId(req);
    sendSuccess(res, await catalogAdminService.listSkus({ vendorId }), "SKUs fetched");
  }),
};
