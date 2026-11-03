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
  await ensureProductSkuIndexIsSparse();
  logger.info("MongoDB connected");
}

/** Older deploys created a non-sparse unique sku index, which blocks creating a second product without a legacy sku. */
async function ensureProductSkuIndexIsSparse(): Promise<void> {
  const collection = mongoose.connection.collection("products");
  try {
    const indexes = await collection.indexes();
    const skuIndex = indexes.find((index) => index.name === "sku_1");
    if (skuIndex && !skuIndex.sparse) {
      await collection.dropIndex("sku_1");
      await collection.createIndex({ sku: 1 }, { unique: true, sparse: true, background: true, name: "sku_1" });
      logger.info("Repaired products.sku unique index to sparse");
    }
  } catch (error) {
    logger.warn("Could not verify products.sku index", error);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
