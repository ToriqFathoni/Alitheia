import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

const server = app.listen(env.PORT, () => {
  logger.info(`[Alitheia API] Server berjalan di port ${env.PORT} pada environment ${env.NODE_ENV}`);
});

process.on("SIGTERM", () => {
  logger.info("[Alitheia API] Menerima SIGTERM, menutup server secara graceful...");
  server.close(() => {
    logger.info("[Alitheia API] Server telah ditutup.");
    process.exit(0);
  });
});
