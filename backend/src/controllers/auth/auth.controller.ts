import { Request, Response } from "express";
import { COOKIE_NAME } from "../../config/constants";
import { clearCookieOptions } from "../../middleware/auth.middleware";
import { authService, toPublicUser } from "../../services/auth/auth.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { Vendor } from "../../models/Vendor";

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.register(req.body);
    await authService.issueSession(res, user);
    sendSuccess(res, toPublicUser(user), "Registration successful", 201);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.login(req.body.email, req.body.password);
    await authService.issueSession(res, user);
    if (Array.isArray(req.body.guestCart)) {
      await authService.mergeGuestCart(user.id, req.body.guestCart);
    }
    const vendor = await Vendor.findOne({ userId: user._id });
    sendSuccess(res, toPublicUser(user, vendor?.id), "Login successful");
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;
    await authService.logout(token);
    res.clearCookie(COOKIE_NAME, clearCookieOptions());
    sendSuccess(res, null, "Logged out successfully");
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const data = await authService.me(req.user!.id);
    sendSuccess(res, data, "Current user fetched successfully");
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    sendSuccess(res, null, "Password updated successfully");
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const data = await authService.updateProfile(req.user!.id, req.body);
    sendSuccess(res, data, "Profile updated successfully");
  }),
};
