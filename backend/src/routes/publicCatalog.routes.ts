import { Request, Response, Router } from "express";
import { catalogAdminService } from "../services/catalog/catalogAdmin.service";
import { getPlatformSettings } from "../models/PlatformSettings";
import { sendSuccess } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";

function clientIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || req.ip || "";
  const ip = raw.replace(/^::ffff:/, "");
  if (!ip || ip === "::1" || ip === "127.0.0.1") return null;
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) return null;
  const [a, b] = ip.split(".").map(Number);
  if (a === 172 && b >= 16 && b <= 31) return null;
  return ip;
}

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
        lowStockDisplayThreshold: settings.lowStockDisplayThreshold ?? 5,
        inStockDisplayThreshold: settings.inStockDisplayThreshold ?? 10,
        freeShippingThresholdCents: settings.freeShippingThresholdCents ?? 0,
      },
      "Settings fetched",
    );
  }),
};

const brandRouter = Router();
brandRouter.get("/", publicBrandController.list);
brandRouter.get("/:slug", publicBrandController.get);
export const brandRoutes = brandRouter;

export const locationHintController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const ip = clientIp(req);
    if (!ip) {
      sendSuccess(res, { city: null, region: null, postalCode: null }, "Location unavailable");
      return;
    }
    try {
      const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(2500),
      });
      const body = (await response.json()) as {
        success?: boolean;
        city?: string;
        region?: string;
        postal?: string;
      };
      if (!response.ok || body.success === false || !body.city) {
        sendSuccess(res, { city: null, region: null, postalCode: null }, "Location unavailable");
        return;
      }
      sendSuccess(
        res,
        { city: body.city, region: body.region || null, postalCode: body.postal || null },
        "Location suggested",
      );
    } catch {
      sendSuccess(res, { city: null, region: null, postalCode: null }, "Location unavailable");
    }
  }),
};

const settingsRouter = Router();
settingsRouter.get("/location-hint", locationHintController.get);
settingsRouter.get("/", publicSettingsController.get);
export const settingsRoutes = settingsRouter;
