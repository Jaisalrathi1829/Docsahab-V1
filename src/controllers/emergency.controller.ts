// ============================================================================
// Emergency Controller
// ============================================================================
// HTTP layer — receives requests, delegates to the service layer, and
// returns standardized API responses. No business logic lives here.
// ============================================================================

import { Request, Response, NextFunction } from "express";
import * as emergencyService from "../services/emergency.service";
import { successResponse } from "../utils/api-response";
import { CreateEmergencyInput, UpdateStatusInput } from "../types/emergency.types";

// --------------------------------------------------------------------------
// POST /api/v1/sos
// --------------------------------------------------------------------------

/**
 * Creates a new emergency (SOS trigger).
 *
 * The patient app calls this when the user presses the SOS button.
 * The emergency is created with SOS_TRIGGERED status and an initial
 * timeline event is recorded automatically.
 */
export async function createEmergency(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input: CreateEmergencyInput = req.body;
    const emergency = await emergencyService.createEmergency(input);

    res.status(201).json(
      successResponse(emergency, "Emergency created successfully")
    );
  } catch (error) {
    next(error);
  }
}

// --------------------------------------------------------------------------
// GET /api/v1/emergency/:id
// --------------------------------------------------------------------------

/**
 * Returns the complete emergency with all relations.
 *
 * Consumed by:
 * - Patient app (status stepper, ambulance info)
 * - Ambulance app (patient info, severity, hospital assignment)
 * - Hospital dashboard (incoming request details, timeline)
 * - All backend modules for current state queries
 */
export async function getEmergencyById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const emergency = await emergencyService.getEmergencyById(id);

    res.status(200).json(
      successResponse(emergency, "Emergency retrieved successfully")
    );
  } catch (error) {
    next(error);
  }
}

// --------------------------------------------------------------------------
// PATCH /api/v1/emergency/:id/status
// --------------------------------------------------------------------------

/**
 * Advances the emergency through its lifecycle.
 *
 * This endpoint enforces the state machine — invalid transitions are
 * rejected with 400 and a clear error message listing valid next states.
 *
 * Called by all modules:
 * - Ambulance Matching → AMBULANCE_ASSIGNED, AMBULANCE_EN_ROUTE
 * - Ambulance app → PATIENT_PICKED_UP, SEVERITY_SELECTED
 * - Hospital Ranking → HOSPITAL_SEARCHING, HOSPITAL_ACCEPTANCE_REQUESTED
 * - Hospital Acceptance → HOSPITAL_ACCEPTED
 * - Hospital app → HOSPITAL_NOTIFIED
 * - Ambulance app → EN_ROUTE_TO_HOSPITAL, ARRIVED
 */
export async function updateEmergencyStatus(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const input: UpdateStatusInput = req.body;
    const emergency = await emergencyService.updateEmergencyStatus(id, input);

    res.status(200).json(
      successResponse(emergency, `Status updated to ${input.status}`)
    );
  } catch (error) {
    next(error);
  }
}

// --------------------------------------------------------------------------
// GET /api/v1/emergency/:id/timeline
// --------------------------------------------------------------------------

/**
 * Returns the complete timeline for an emergency.
 *
 * Provides a chronological audit trail consumed by all three frontends'
 * "Emergency Progress" views.
 */
export async function getEmergencyTimeline(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const timeline = await emergencyService.getEmergencyTimeline(id);

    res.status(200).json(
      successResponse(timeline, "Timeline retrieved successfully")
    );
  } catch (error) {
    next(error);
  }
}
