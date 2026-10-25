import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  exhibitionLeadController,
  exhibitionLeadSchema,
} from "../controllers/exhibition/exhibitionLead.controller";
import { validate } from "../middleware/validation.middleware";

const exhibitionLeadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many submissions, please try again later",
    errors: [],
  },
});

const router = Router();
router.post("/", exhibitionLeadRateLimiter, validate(exhibitionLeadSchema), exhibitionLeadController.create);

export const exhibitionLeadRoutes = router;
