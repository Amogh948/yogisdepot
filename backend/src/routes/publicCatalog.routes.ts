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
        sameDayDeliveryEnabled: settings.sameDayDeliveryEnabled !== false,
        sameDayCutoffTime: settings.sameDayCutoffTime || "16:00",
        sameDayTimezone: settings.sameDayTimezone || "America/Edmonton",
        sameDayWeekdays: Array.isArray(settings.sameDayWeekdays) ? settings.sameDayWeekdays : [1, 2, 3, 4, 5, 6],
        sameDayPostalPrefixes: Array.isArray(settings.sameDayPostalPrefixes)
          ? settings.sameDayPostalPrefixes
          : [],
        lowStockDisplayThreshold: settings.lowStockDisplayThreshold ?? 5,
        inStockDisplayThreshold: settings.inStockDisplayThreshold ?? 10,
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
