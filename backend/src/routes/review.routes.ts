import { Router } from "express";
import { adminReviewController, reviewController } from "../controllers/products/review.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { createReviewSchema, reviewModerationSchema } from "../schemas/reviews/review.schema";

const router = Router();

router.get("/product/:productId", reviewController.listForProduct);
router.get("/me", authenticate, requireRoles("customer", "admin"), reviewController.mine);
router.post("/", authenticate, requireRoles("customer", "admin"), validate(createReviewSchema), reviewController.create);
router.patch("/:id", authenticate, requireRoles("admin"), validate(reviewModerationSchema), adminReviewController.moderate);

export const reviewRoutes = router;
