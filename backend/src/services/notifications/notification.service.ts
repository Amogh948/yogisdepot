import { Notification, NotificationType } from "../../models/Notification";
import { Types } from "mongoose";

interface NotifyInput {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, string>;
}

export const notificationService = {
  async notify(input: NotifyInput) {
    return Notification.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: input.metadata,
    });
  },

  async list(userId: string, unreadOnly = false) {
    const filter: Record<string, unknown> = { userId };
    if (unreadOnly) {
      filter.isRead = false;
    }
    return Notification.find(filter).sort({ createdAt: -1 }).limit(50);
  },

  async markRead(userId: string, notificationId: string) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true },
    );
  },

  async markAllRead(userId: string) {
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  },
};
