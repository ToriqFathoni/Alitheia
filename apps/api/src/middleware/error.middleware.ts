import { Request, Response, NextFunction } from "express";
import type { ApiResponseError } from "@alitheia/shared-types";
import { logger } from "../lib/logger.js";

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = (res.locals.requestId as string) || "unknown";
  const errorPayload: ApiResponseError = {
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Rute '${req.method} ${req.originalUrl}' tidak ditemukan.`,
    },
    meta: {
      requestId,
    },
  };
  res.status(404).json(errorPayload);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const requestId = (res.locals.requestId as string) || "unknown";

  if (err instanceof AppError) {
    logger.warn({ err, requestId }, `[AppError] ${err.code}: ${err.message}`);
    const payload: ApiResponseError = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta: {
        requestId,
      },
    };
    res.status(err.statusCode).json(payload);
    return;
  }

  logger.error({ err, requestId }, "[UnhandledError] Terjadi kesalahan internal pada server");

  const payload: ApiResponseError = {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Terjadi kesalahan internal pada server.",
    },
    meta: {
      requestId,
    },
  };

  res.status(500).json(payload);
}
