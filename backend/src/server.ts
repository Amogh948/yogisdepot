import { createApp } from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { logger } from "./utils/logger";

async function bootstrap(): Promise<void> {
  await connectDatabase();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`Yogi's Depot API listening on port ${env.PORT}`);
  });
}

bootstrap().catch((error: unknown) => {
  logger.error("Failed to start server", error instanceof Error ? error.message : error);
  process.exit(1);
});
