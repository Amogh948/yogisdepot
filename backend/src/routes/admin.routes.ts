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
import {
  adminFmcgController,
  productStackUpdateSchema,
  productWizardSchema,
} from "../controllers/fmcg/fmcg.controller";
import {
  adminMerchandisingController,
  merchandisingSchema,
  merchandisingUpdateSchema,
  productMerchandisingSchema,
} from "../controllers/merchandising/merchandising.controller";
import {
  adminDeliveryLocationController,
  deliveryLocationSchema,
  deliveryLocationUpdateSchema,
} from "../controllers/delivery/deliveryLocation.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { categorySchema, categoryUpdateSchema } from "../schemas/categories/category.schema";
import { vendorStatusSchema, vendorListQuerySchema, adminVendorCreateSchema, vendorUpdateSchema } from "../schemas/vendors/vendor.schema";
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
router.post("/vendors", validate(adminVendorCreateSchema), adminVendorController.create);
router.get("/vendors/:id", adminVendorController.get);
router.put("/vendors/:id", validate(vendorUpdateSchema), adminVendorController.update);
router.patch("/vendors/:id/status", validate(vendorStatusSchema), adminVendorController.setStatus);
router.delete("/vendors/:id", adminVendorController.remove);

router.get("/categories", adminCategoryController.list);
router.post("/categories", validate(categorySchema), adminCategoryController.create);
router.get("/categories/:id", adminCategoryController.get);
router.put("/categories/:id", validate(categoryUpdateSchema), adminCategoryController.update);
router.delete("/categories/:id", adminCategoryController.remove);

router.get("/products", adminProductController.list);
router.post("/products", validate(createProductSchema), adminProductController.create);
router.post("/products/wizard", validate(productWizardSchema), adminFmcgController.createProductWizard);
router.get("/products/:id", adminFmcgController.getProductStack);
router.get("/products/:id/merchandising", adminMerchandisingController.forProduct);
router.put("/products/:id/merchandising", validate(productMerchandisingSchema), adminMerchandisingController.setProduct);
router.put("/products/:id/stack", validate(productStackUpdateSchema), adminFmcgController.updateProductStack);
router.put("/products/:id", validate(updateProductSchema), adminProductController.update);
router.patch("/products/:id/status", validate(productStatusSchema), adminProductController.setStatus);
router.delete("/products/:id", adminProductController.remove);

router.get("/brands", adminFmcgController.brands);
router.post("/brands", adminFmcgController.createBrand);
router.get("/tax-categories", adminFmcgController.taxCategories);
router.post("/tax-categories", adminFmcgController.createTaxCategory);
router.get("/tax-rates", adminFmcgController.taxRates);
router.post("/tax-rates", adminFmcgController.createTaxRate);
router.get("/warehouses", adminFmcgController.warehouses);
router.post("/warehouses", adminFmcgController.createWarehouse);
router.get("/skus", adminFmcgController.skus);
router.get("/inventory", adminFmcgController.inventory);
router.get("/batches", adminFmcgController.batches);
router.get("/pricing", adminFmcgController.pricing);
router.get("/scratch-campaigns", adminFmcgController.scratchCampaigns);
router.post("/scratch-campaigns", adminFmcgController.createScratchCampaign);

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

router.get("/merchandising", adminMerchandisingController.list);
router.post("/merchandising", validate(merchandisingSchema), adminMerchandisingController.create);
router.get("/merchandising/:id", adminMerchandisingController.get);
router.put("/merchandising/:id", validate(merchandisingUpdateSchema), adminMerchandisingController.update);
router.delete("/merchandising/:id", adminMerchandisingController.remove);

router.get("/delivery-locations", adminDeliveryLocationController.list);
router.post("/delivery-locations", validate(deliveryLocationSchema), adminDeliveryLocationController.create);
router.get("/delivery-locations/:id", adminDeliveryLocationController.get);
router.put("/delivery-locations/:id", validate(deliveryLocationUpdateSchema), adminDeliveryLocationController.update);
router.delete("/delivery-locations/:id", adminDeliveryLocationController.remove);

export const adminRoutes = router;
