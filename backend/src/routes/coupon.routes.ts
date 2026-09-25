import { Router } from "express";
import { adminCouponController, couponController } from "../controllers/coupons/coupon.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { couponSchema, couponUpdateSchema, validateCouponSchema } from "../schemas/coupons/coupon.schema";

const router = Router();

router.post("/validate", authenticate, validate(validateCouponSchema), couponController.validate);
router.get("/", authenticate, requireRoles("admin"), adminCouponController.list);
router.post("/", authenticate, requireRoles("admin"), validate(couponSchema), adminCouponController.create);
router.put("/:id", authenticate, requireRoles("admin"), validate(couponUpdateSchema), adminCouponController.update);
router.delete("/:id", authenticate, requireRoles("admin"), adminCouponController.remove);

export const couponRoutes = router;
