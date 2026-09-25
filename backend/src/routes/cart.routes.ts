import { Router } from "express";
import { cartController } from "../controllers/cart/cart.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { cartItemSchema, updateCartItemSchema } from "../schemas/carts/cart.schema";

const router = Router();

router.use(authenticate, requireRoles("customer", "admin"));
router.get("/", cartController.get);
router.post("/", validate(cartItemSchema), cartController.add);
router.patch("/:productId", validate(updateCartItemSchema), cartController.update);
router.delete("/", cartController.clear);
router.delete("/:productId", cartController.remove);

export const cartRoutes = router;
