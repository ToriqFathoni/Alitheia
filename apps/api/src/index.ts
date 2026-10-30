import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { checksRouter } from "./routes/checks.js";
import { closeRedis } from "./services/queue.js";

dotenv.config({ path: "../../.env" });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(checksRouter);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Alitheia AI Detection API",
    timestamp: new Date().toISOString(),
  });
});

const server = app.listen(PORT, () => {
  console.log(`[Alitheia API] Server is running on port ${PORT}`);
});

async function gracefulShutdown(signal: string) {
  console.log(`[Alitheia API] Received ${signal}, closing server gracefully...`);
  server.close(async () => {
    console.log("[Alitheia API] HTTP server closed.");
    try {
      await closeRedis();
      console.log("[Alitheia API] Redis connection closed.");
    } catch (err) {
      console.error("[Alitheia API] Error during Redis shutdown:", err);
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
