import { Router } from "express";
import {
  deliveryCheckSchema,
  publicDeliveryLocationController,
} from "../controllers/delivery/deliveryLocation.controller";
import { validate } from "../middleware/validation.middleware";

const router = Router();
router.get("/", publicDeliveryLocationController.list);
router.post("/check", validate(deliveryCheckSchema), publicDeliveryLocationController.check);

export const deliveryRoutes = router;
