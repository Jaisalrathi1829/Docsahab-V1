// ============================================================================
// Hospital Ranking & Acceptance — HTTP Controller (Person 3)
// ============================================================================
// Thin HTTP layer. Delegates to the hospital service and returns the
// foundation's standardized API response shape. No business logic here.
// ============================================================================

import { Request, Response, NextFunction } from "express";
import * as hospitalService from "../services/hospital.service";
import { successResponse } from "../utils/api-response";

// --------------------------------------------------------------------------
// POST /api/v1/emergency/:id/find-hospitals
// --------------------------------------------------------------------------

/**
 * Manually starts (or re-runs) a hospital search round for an emergency:
 * discovery → ranking → candidate generation → parallel requests.
 * The same search also runs automatically when the emergency enters
 * AMBULANCE_EN_ROUTE; this endpoint exists for dispatchers, retries, and the
 * classic post-severity path.
 */
export async function findHospitals(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const round = await hospitalService.startHospitalSearch(id);
    res
      .status(200)
      .json(
        successResponse(
          round,
          round.candidates.length > 0
            ? `${round.candidates.length} hospital(s) ranked and requested`
            : "No new eligible hospitals found"
        )
      );
  } catch (error) {
    next(error);
  }
}

// --------------------------------------------------------------------------
// POST /api/v1/emergency/:id/hospital-response
// --------------------------------------------------------------------------

/**
 * Records a hospital's ACCEPT or REJECT for an emergency it was requested
 * for. Idempotent; acceptance is transactional and race-safe.
 */
export async function respondToRequest(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { hospitalId, response, rejectionReason } = req.body as {
      hospitalId: string;
      response: "ACCEPTED" | "REJECTED";
      rejectionReason?: string;
    };

    const result = await hospitalService.respondToHospitalRequest(
      id,
      hospitalId,
      response,
      rejectionReason
    );

    const message = result.idempotent
      ? "Response already recorded (idempotent replay)"
      : result.locked && !result.assignmentChanged && response === "ACCEPTED"
        ? "Hospital assignment is locked — response ignored"
        : result.assignmentChanged
          ? "Hospital assigned to emergency"
          : `Hospital response ${response} recorded`;

    res.status(200).json(successResponse(result, message));
  } catch (error) {
    next(error);
  }
}

// --------------------------------------------------------------------------
// POST /api/v1/emergency/:id/notify-hospital
// --------------------------------------------------------------------------

/**
 * Notifies the assigned hospital after severity selection (final severity,
 * patient onboard, updated ETA, critical alerts) and advances the emergency
 * to HOSPITAL_NOTIFIED via the Emergency Core Service.
 */
export async function notifyHospital(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const emergency = await hospitalService.notifyAssignedHospital(id);
    res
      .status(200)
      .json(successResponse(emergency, "Assigned hospital notified"));
  } catch (error) {
    next(error);
  }
}

// --------------------------------------------------------------------------
// GET /api/v1/hospital/:hospitalId/requests
// --------------------------------------------------------------------------

/**
 * A hospital console's inbox: pending acceptance requests addressed to this
 * hospital, each carrying the full request payload (emergency type, patient
 * age, critical alerts, estimated arrival, required services).
 */
export async function listHospitalRequests(
  req: Request<{ hospitalId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { hospitalId } = req.params;
    const requests = await hospitalService.getHospitalRequests(hospitalId);
    res
      .status(200)
      .json(successResponse(requests, "Pending hospital requests retrieved"));
  } catch (error) {
    next(error);
  }
}
