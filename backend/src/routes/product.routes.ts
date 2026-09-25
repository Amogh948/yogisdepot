import { Router } from "express";
import { validate } from "../middleware/validation.middleware";
import { productController } from "../controllers/products/product.controller";
import { productQuerySchema } from "../schemas/products/product.schema";

const router = Router();

router.get("/", validate(productQuerySchema, "query"), productController.list);
router.get("/:id/related", productController.related);
router.get("/id/:id", productController.getById);
router.get("/:slug", productController.getBySlug);

export const productRoutes = router;
