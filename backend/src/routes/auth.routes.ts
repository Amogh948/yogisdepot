import { Router } from "express";
import { authController } from "../controllers/auth/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authRateLimiter } from "../middleware/rateLimit.middleware";
import { validate } from "../middleware/validation.middleware";
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "../schemas/auth/auth.schema";

const router = Router();

router.post("/register", authRateLimiter, validate(registerSchema), authController.register);
router.post("/login", authRateLimiter, validate(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);
router.patch("/password", authenticate, validate(changePasswordSchema), authController.changePassword);
router.patch("/profile", authenticate, validate(updateProfileSchema), authController.updateProfile);

export const authRoutes = router;
