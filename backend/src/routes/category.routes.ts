import { Router } from "express";
import { adminCategoryController, categoryController } from "../controllers/products/category.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { categorySchema, categoryUpdateSchema } from "../schemas/categories/category.schema";

const router = Router();

router.get("/", categoryController.tree);
router.get("/:slug", categoryController.getBySlug);

router.post("/", authenticate, requireRoles("admin"), validate(categorySchema), adminCategoryController.create);
router.put("/:id", authenticate, requireRoles("admin"), validate(categoryUpdateSchema), adminCategoryController.update);
router.delete("/:id", authenticate, requireRoles("admin"), adminCategoryController.remove);

export const categoryRoutes = router;
