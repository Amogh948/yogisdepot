import { Router } from "express";
import { vendorAnalyticsController, uploadController } from "../controllers/admin/admin.controller";
import { vendorOrderController } from "../controllers/orders/order.controller";
import { vendorProductController } from "../controllers/products/product.controller";
import { vendorController } from "../controllers/vendor/vendor.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRoles, requireVendor } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { uploadImage } from "../middleware/upload.middleware";
import { vendorApplySchema, vendorUpdateSchema } from "../schemas/vendors/vendor.schema";
import {
  createProductSchema,
  inventoryAdjustSchema,
  productStatusSchema,
  updateProductSchema,
} from "../schemas/products/product.schema";
import { orderStatusSchema } from "../schemas/orders/order.schema";

const router = Router();

router.get("/public/:slug", vendorController.getPublic);
router.post("/apply", authenticate, requireRoles("customer", "vendor"), validate(vendorApplySchema), vendorController.apply);

router.use(authenticate, requireVendor);
router.get("/me", vendorController.me);
router.patch("/me", validate(vendorUpdateSchema), vendorController.updateMe);
router.get("/analytics", vendorAnalyticsController.overview);

router.get("/products", vendorProductController.list);
router.post("/products", validate(createProductSchema), vendorProductController.create);
router.put("/products/:id", validate(updateProductSchema), vendorProductController.update);
router.patch("/products/:id/status", validate(productStatusSchema), vendorProductController.setStatus);
router.delete("/products/:id", vendorProductController.remove);
router.post("/products/:id/inventory", validate(inventoryAdjustSchema), vendorProductController.adjustInventory);
router.get("/products/:id/inventory", vendorProductController.inventoryHistory);

router.get("/orders", vendorOrderController.list);
router.get("/orders/:id", vendorOrderController.get);
router.patch("/orders/:id/status", validate(orderStatusSchema), vendorOrderController.updateStatus);

router.post("/uploads", uploadImage.array("files", 8), uploadController.upload);

export const vendorRoutes = router;
