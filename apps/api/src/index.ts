import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { closeRedis } from "./services/queue.js";

const server = app.listen(env.PORT, () => {
  logger.info(`[Alitheia API] Server berjalan di port ${env.PORT} pada environment ${env.NODE_ENV}`);
});

async function gracefulShutdown(signal: string) {
  logger.info(`[Alitheia API] Menerima ${signal}, menutup server secara graceful...`);
  server.close(async () => {
    logger.info("[Alitheia API] HTTP server closed.");
    try {
      await closeRedis();
      logger.info("[Alitheia API] Redis connection closed.");
    } catch (err) {
      logger.error({ err }, "[Alitheia API] Error during Redis shutdown");
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

export default app;
