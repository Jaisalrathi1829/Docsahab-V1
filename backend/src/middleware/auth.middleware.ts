// ============================================================================
// Authentication Middleware
// ============================================================================
// Resolves the `Authorization: Bearer <token>` header to a caller identity and
// attaches it to the request. Route handlers then act on `req.auth` rather
// than trusting client-supplied ids — which is what stops one patient from
// driving another patient's emergency.
// ============================================================================

import { Request, Response, NextFunction } from "express";
import { SessionRole } from "@prisma/client";
import * as authService from "../services/auth.service";
import { AppError } from "./error-handler.middleware";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: authService.AuthenticatedCaller;
    }
  }
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return undefined;
  return value?.trim() || undefined;
}

/**
 * Requires a valid session. Optionally requires a specific role, so an
 * ambulance token cannot call a patient-only endpoint and vice versa.
 */
export function requireAuth(role?: SessionRole) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const caller = await authService.resolveSession(extractToken(req));

      if (role && caller.role !== role) {
        throw new AppError(
          403,
          "WRONG_ROLE",
          `This endpoint requires a ${role.toLowerCase()} session`
        );
      }

      req.auth = caller;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Reads the raw token for sign-out, which must delete the exact session. */
export function getRequestToken(req: Request): string | undefined {
  return extractToken(req);
}
