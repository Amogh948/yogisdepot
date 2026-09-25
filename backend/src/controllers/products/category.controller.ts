import { Request, Response } from "express";
import { categoryService } from "../../services/products/category.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const categoryController = {
  tree: asyncHandler(async (_req: Request, res: Response) => {
    const data = await categoryService.tree(true);
    sendSuccess(res, data, "Categories fetched successfully");
  }),

  getBySlug: asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.getBySlug(req.params.slug);
    sendSuccess(res, category, "Category fetched successfully");
  }),
};

export const adminCategoryController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const data = await categoryService.listFlat();
    sendSuccess(res, data, "Categories fetched successfully");
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.create(req.body);
    sendSuccess(res, category, "Category created successfully", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.update(req.params.id, req.body);
    sendSuccess(res, category, "Category updated successfully");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.remove(req.params.id);
    sendSuccess(res, category, "Category deactivated successfully");
  }),
};
