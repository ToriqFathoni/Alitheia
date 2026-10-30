import express, { Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";
import { verificationRouter } from "./modules/verification/verification.routes.js";
import { verificationWorker } from "./modules/verification/verification.worker.js";
import type { ApiResponseSuccess } from "@alitheia/shared-types";

// Inisialisasi worker latar belakang untuk pipeline analisis
verificationWorker.init();

export const app = express();

const allowedOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (seperti curl, mobile apps, atau server-to-server)
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS diblokir untuk origin: ${origin}`));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(requestIdMiddleware);

const healthHandler = (_req: Request, res: Response) => {
  const requestId = (res.locals.requestId as string) || "unknown";
  const payload: ApiResponseSuccess<{ status: string; service: string; timestamp: string }> = {
    success: true,
    data: {
      status: "ok",
      service: "Alitheia AI Detection API",
      timestamp: new Date().toISOString(),
    },
    meta: {
      requestId,
    },
  };
  res.status(200).json(payload);
};

// Health check endpoints (v1 dan legacy /api/health untuk kompatibilitas)
app.get("/api/v1/health", healthHandler);
app.get("/api/health", healthHandler);

// Domain routers
app.use("/api/v1/verifications", verificationRouter);

// Catch-all 404 & Global Error Handler
app.use(notFoundHandler);
app.use(errorHandler);
