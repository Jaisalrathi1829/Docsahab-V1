// ============================================================================
// Patient Controller
// ============================================================================
// The patient app's endpoints. Every handler acts on `req.auth.subjectId` —
// the authenticated patient — never on an id supplied by the client.
// ============================================================================

import { Request, Response, NextFunction } from "express";
import * as patientService from "../services/patient.service";
import { buildEmergencyView } from "../services/emergency-view.service";
import { successResponse } from "../utils/api-response";

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const patient = await patientService.getProfile(req.auth!.subjectId);
    res.status(200).json(successResponse(patient, "Profile retrieved"));
  } catch (error) {
    next(error);
  }
}

export async function saveProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body;
    const patient = await patientService.saveProfile(req.auth!.subjectId, {
      fullName: body.fullName,
      age: body.age,
      // The UI says "gender"; the schema column is `sex`. Mapped here so the
      // frontend keeps its own vocabulary without a second column existing.
      sex: body.gender,
      bloodGroup: body.bloodGroup,
      conditions: body.conditions,
      allergies: body.allergies,
      medications: body.medications,
      emergencyContactName: body.emergencyContactName,
      emergencyContactPhone: body.emergencyContactPhone,
    });
    res.status(200).json(successResponse(patient, "Profile saved"));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /patient/me/emergency — the live emergency, as a view-model.
 * Returns null data (200) when idle so the app can poll without treating
 * "nothing happening" as an error.
 */
export async function getActiveEmergency(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emergency = await patientService.getActiveEmergency(
      req.auth!.subjectId
    );
    res
      .status(200)
      .json(
        successResponse(
          emergency ? buildEmergencyView(emergency) : null,
          emergency ? "Active emergency retrieved" : "No active emergency"
        )
      );
  } catch (error) {
    next(error);
  }
}

/**
 * POST /patient/me/sos — the real SOS. Creates the emergency AND requests an
 * ambulance server-side, so a confirmed SOS is always a dispatched SOS.
 */
export async function triggerSos(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await patientService.triggerSos(req.auth!.subjectId, {
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      address: req.body.address,
      locationIsPrecise: req.body.locationIsPrecise,
    });

    res.status(result.alreadyActive ? 200 : 201).json(
      successResponse(
        {
          emergency: buildEmergencyView(result.emergency),
          dispatch: result.dispatch,
          alreadyActive: result.alreadyActive,
        },
        result.alreadyActive
          ? "An emergency is already active"
          : "Emergency created"
      )
    );
  } catch (error) {
    next(error);
  }
}

export async function cancelEmergency(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emergency = await patientService.cancelActiveEmergency(
      req.auth!.subjectId
    );
    res
      .status(200)
      .json(successResponse(buildEmergencyView(emergency), "Emergency cancelled"));
  } catch (error) {
    next(error);
  }
}
