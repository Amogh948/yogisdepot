import { Router } from "express";
import { wishlistBodySchema, wishlistController } from "../controllers/customer/customerWishlist.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";

const router = Router();

router.use(authenticate, requireRoles("customer", "admin"));
router.get("/", wishlistController.list);
router.post("/", validate(wishlistBodySchema), wishlistController.add);
router.delete("/:productId", wishlistController.remove);

export const wishlistRoutes = router;
