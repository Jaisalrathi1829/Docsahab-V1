// ============================================================================
// Ambulance Matching — HTTP Controller
// ============================================================================
// Thin HTTP layer. Delegates to the ambulance service and returns the
// foundation's standardized API response shape. No business logic here.
// ============================================================================

import { Request, Response, NextFunction } from "express";
import * as ambulanceService from "../services/ambulance.service";
import { successResponse } from "../utils/api-response";

// --------------------------------------------------------------------------
// POST /api/v1/emergency/:id/assign-ambulance
// --------------------------------------------------------------------------

/**
 * Finds the nearest available ambulance for the emergency and assigns it,
 * advancing the emergency to AMBULANCE_ASSIGNED with an ETA.
 *
 * Input:  emergencyId (URL param)
 * Output: the full updated emergency (assignedAmbulanceId + etaMinutes set)
 */
export async function assignAmbulance(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const emergency = await ambulanceService.assignNearestAmbulance(id);
    res
      .status(200)
      .json(successResponse(emergency, "Ambulance assigned successfully"));
  } catch (error) {
    next(error);
  }
}

// --------------------------------------------------------------------------
// GET /api/v1/ambulances?available=true|false
// --------------------------------------------------------------------------

/**
 * Lists ambulances (optionally filtered by availability) — supports ambulance
 * discovery and ops dashboards. Read-only.
 */
export async function listAmbulances(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const availableParam = req.query.available as "true" | "false" | undefined;
    const available =
      availableParam === undefined ? undefined : availableParam === "true";

    const ambulances = await ambulanceService.listAmbulances(available);
    res
      .status(200)
      .json(successResponse(ambulances, "Ambulances retrieved successfully"));
  } catch (error) {
    next(error);
  }
}
