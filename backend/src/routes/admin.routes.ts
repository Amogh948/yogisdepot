import { Router } from "express";
import {
  adminAnalyticsController,
  adminCustomerController,
  adminSettingsController,
  settingsUpdateSchema,
  uploadController,
} from "../controllers/admin/admin.controller";
import { adminCategoryController } from "../controllers/products/category.controller";
import { adminProductController } from "../controllers/products/product.controller";
import { adminOrderController } from "../controllers/orders/order.controller";
import { adminVendorController } from "../controllers/vendor/vendor.controller";
import { adminReviewController } from "../controllers/products/review.controller";
import { adminCouponController } from "../controllers/coupons/coupon.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { vendorStatusSchema, vendorListQuerySchema } from "../schemas/vendors/vendor.schema";
import { createProductSchema, productStatusSchema, updateProductSchema } from "../schemas/products/product.schema";
import { orderStatusSchema } from "../schemas/orders/order.schema";
import { couponSchema, couponUpdateSchema } from "../schemas/coupons/coupon.schema";
import { reviewModerationSchema } from "../schemas/reviews/review.schema";
import { uploadImage } from "../middleware/upload.middleware";
import { z } from "zod";

const router = Router();

router.use(authenticate, requireRoles("admin"));

router.get("/analytics", adminAnalyticsController.overview);
router.get("/settings", adminSettingsController.get);
router.patch("/settings", validate(settingsUpdateSchema), adminSettingsController.update);

router.get("/customers", adminCustomerController.list);
router.patch(
  "/customers/:id",
  validate(z.object({ isActive: z.boolean() })),
  adminCustomerController.setActive,
);

router.get("/vendors", validate(vendorListQuerySchema, "query"), adminVendorController.list);
router.get("/vendors/:id", adminVendorController.get);
router.patch("/vendors/:id/status", validate(vendorStatusSchema), adminVendorController.setStatus);

router.get("/categories", adminCategoryController.list);

router.get("/products", adminProductController.list);
router.post("/products", validate(createProductSchema), adminProductController.create);
router.put("/products/:id", validate(updateProductSchema), adminProductController.update);
router.patch("/products/:id/status", validate(productStatusSchema), adminProductController.setStatus);
router.delete("/products/:id", adminProductController.remove);

router.get("/orders", adminOrderController.list);
router.get("/orders/:id", adminOrderController.get);
router.patch("/orders/:id/status", validate(orderStatusSchema), adminOrderController.updateStatus);

router.get("/coupons", adminCouponController.list);
router.post("/coupons", validate(couponSchema), adminCouponController.create);
router.put("/coupons/:id", validate(couponUpdateSchema), adminCouponController.update);
router.delete("/coupons/:id", adminCouponController.remove);

router.get("/reviews", adminReviewController.list);
router.patch("/reviews/:id", validate(reviewModerationSchema), adminReviewController.moderate);

router.post("/uploads", uploadImage.array("files", 8), uploadController.upload);

export const adminRoutes = router;
