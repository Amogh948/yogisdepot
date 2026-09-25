import { Router } from "express";
import { customerOrderController } from "../controllers/orders/order.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { createOrderSchema, razorpayVerifySchema } from "../schemas/orders/order.schema";

const router = Router();

router.use(authenticate, requireRoles("customer", "admin"));
router.get("/quote", customerOrderController.quote);
router.post("/", validate(createOrderSchema), customerOrderController.create);
router.post("/:id/pay/verify", validate(razorpayVerifySchema), customerOrderController.verifyPayment);
router.get("/", customerOrderController.list);
router.get("/:id", customerOrderController.get);
router.post("/:id/cancel", customerOrderController.cancel);

export const orderRoutes = router;
