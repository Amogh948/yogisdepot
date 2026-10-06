import { Request, Response, Router } from "express";
import { catalogAdminService } from "../services/catalog/catalogAdmin.service";
import { getPlatformSettings } from "../models/PlatformSettings";
import { sendSuccess } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const publicBrandController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await catalogAdminService.listPublicBrands(), "Brands fetched");
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await catalogAdminService.getPublicBrand(req.params.slug), "Brand fetched");
  }),
};

export const publicSettingsController = {
  get: asyncHandler(async (_req: Request, res: Response) => {
    const settings = await getPlatformSettings();
    sendSuccess(
      res,
      {
        siteName: settings.siteName,
        currency: settings.currency || "CAD",
        supportEmail: settings.supportEmail,
      },
      "Settings fetched",
    );
  }),
};

const brandRouter = Router();
brandRouter.get("/", publicBrandController.list);
brandRouter.get("/:slug", publicBrandController.get);
export const brandRoutes = brandRouter;

const settingsRouter = Router();
settingsRouter.get("/", publicSettingsController.get);
export const settingsRoutes = settingsRouter;
