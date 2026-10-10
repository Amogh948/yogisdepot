import mongoose, { Document, Model, Schema } from "mongoose";

export interface SquareWebhookEventDocument extends Document {
  eventId: string;
  eventType: string;
  paymentId?: string;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const squareWebhookEventSchema = new Schema<SquareWebhookEventDocument>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
    paymentId: { type: String, index: true },
    processedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

export const SquareWebhookEvent: Model<SquareWebhookEventDocument> =
  mongoose.models.SquareWebhookEvent ||
  mongoose.model<SquareWebhookEventDocument>("SquareWebhookEvent", squareWebhookEventSchema);
