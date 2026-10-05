import { Router } from "express";
import { scratchController } from "../controllers/scratch/scratch.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";

const router = Router();

router.get("/campaign", scratchController.activeCampaign);
router.post("/scratch", authenticate, requireRoles("customer", "admin"), scratchController.scratch);
router.get("/rewards", authenticate, requireRoles("customer", "admin"), scratchController.rewards);

export const scratchRoutes = router;
