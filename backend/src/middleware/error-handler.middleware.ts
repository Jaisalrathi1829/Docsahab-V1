// ============================================================================
// Global Error Handler Middleware
// ============================================================================
// Catches all unhandled errors from controllers/services and returns
// a structured error response. Prevents stack traces from leaking
// to clients in production.
// ============================================================================

import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/api-response";

/**
 * Custom application error with HTTP status code and error code.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "AppError";
  }
}

/**
 * Global error handler — must be registered LAST in the Express middleware chain.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Known application error
  if (err instanceof AppError) {
    res.status(err.statusCode).json(
      errorResponse(err.code, err.message)
    );
    return;
  }

  // Unknown error — log full stack, return generic message
  console.error("Unhandled error:", err);

  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err.message;

  res.status(500).json(
    errorResponse("INTERNAL_SERVER_ERROR", message)
  );
}
