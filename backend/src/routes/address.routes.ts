import { Router } from "express";
import { addressController } from "../controllers/customer/customerAddress.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { addressSchema, addressUpdateSchema } from "../schemas/addresses/address.schema";

const router = Router();

router.use(authenticate, requireRoles("customer", "admin"));
router.get("/", addressController.list);
router.post("/", validate(addressSchema), addressController.create);
router.put("/:id", validate(addressUpdateSchema), addressController.update);
router.delete("/:id", addressController.remove);

export const addressRoutes = router;
