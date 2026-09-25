import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import { isProduction } from "../config/env";
import { AppError } from "../errors/AppError";
import { logger } from "../utils/logger";
import { sendError } from "../utils/apiResponse";

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  if (err instanceof ZodError) {
    sendError(
      res,
      "Validation failed",
      422,
      err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
    return;
  }

  if (err instanceof multer.MulterError) {
    sendError(res, err.message, 400);
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    sendError(res, "Invalid identifier", 400);
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    sendError(res, "Validation failed", 422, Object.values(err.errors).map((e) => e.message));
    return;
  }

  const mongoErr = err as { code?: number };
  if (mongoErr.code === 11000) {
    sendError(res, "A record with this value already exists", 409);
    return;
  }

  logger.error("Unhandled error", err);
  const message = isProduction ? "Internal server error" : err instanceof Error ? err.message : "Internal server error";
  sendError(res, message, 500);
}
