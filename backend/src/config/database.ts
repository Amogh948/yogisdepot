import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

function redactMongoUri(uri: string): string {
  return uri.replace(/\/\/([^:/@]+):([^@]+)@/, "//***:***@");
}

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);
  const uri = env.MONGODB_URI;
  logger.info(`Connecting to MongoDB ${redactMongoUri(uri)}`);
  try {
    await mongoose.connect(uri);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new Error(
      `Could not connect using MONGODB_URI from .env (${redactMongoUri(uri)}): ${message}`,
    );
    throw wrapped;
  }
  logger.info("MongoDB connected");
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
