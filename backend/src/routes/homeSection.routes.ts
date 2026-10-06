import { Router } from "express";
import { publicHomeSectionController } from "../controllers/catalog/homeSection.controller";

const router = Router();

router.get("/", publicHomeSectionController.list);

export const homeSectionRoutes = router;
