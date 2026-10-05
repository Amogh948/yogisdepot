import mongoose, { Document, Model, Schema } from "mongoose";

export interface CounterDocument extends Document {
  key: string;
  seq: number;
}

const counterSchema = new Schema<CounterDocument>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter: Model<CounterDocument> =
  mongoose.models.Counter || mongoose.model<CounterDocument>("Counter", counterSchema);
