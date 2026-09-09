// ============================================================================
// Zod Validation Middleware
// ============================================================================
// Generic middleware that validates request body and/or params against
// Zod schemas. Rejects invalid requests with 400 and detailed errors
// before they ever reach the controller.
// ============================================================================

import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { errorResponse } from "../utils/api-response";

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Returns Express middleware that validates the specified parts of the request.
 *
 * Usage:
 *   router.post("/sos", validate({ body: createEmergencySchema }), controller.create);
 *   router.get("/:id", validate({ params: emergencyIdParamSchema }), controller.getById);
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));

        res.status(400).json(
          errorResponse(
            "VALIDATION_ERROR",
            "Request validation failed",
            details
          )
        );
        return;
      }
      next(error);
    }
  };
}
