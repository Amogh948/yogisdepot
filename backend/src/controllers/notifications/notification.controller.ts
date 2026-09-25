import { Request, Response } from "express";
import { notificationService } from "../../services/notifications/notification.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const notificationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const unreadOnly = req.query.unread === "true";
    const data = await notificationService.list(req.user!.id, unreadOnly);
    sendSuccess(res, data, "Notifications fetched successfully");
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    const notification = await notificationService.markRead(req.user!.id, req.params.id);
    sendSuccess(res, notification, "Notification marked as read");
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationService.markAllRead(req.user!.id);
    sendSuccess(res, null, "All notifications marked as read");
  }),
};
