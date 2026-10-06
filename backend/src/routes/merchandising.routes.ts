import { Router } from "express";
import { publicMerchandisingController } from "../controllers/merchandising/merchandising.controller";

const router = Router();
router.get("/", publicMerchandisingController.list);
router.get("/:slug", publicMerchandisingController.getBySlug);

export const merchandisingRoutes = router;
