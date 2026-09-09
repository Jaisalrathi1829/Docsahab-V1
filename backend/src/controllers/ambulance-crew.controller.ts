// ============================================================================
// Ambulance Crew Controller
// ============================================================================
// The ambulance app's endpoints. Every emergency action is guarded by
// `assertAssignedTo`, so a crew can only act on the emergency dispatch gave
// them — the shared Emergency row, not a copy.
// ============================================================================

import { Request, Response, NextFunction } from "express";
import { EmergencyStatus } from "../enums/emergency-status.enum";
import * as crewService from "../services/ambulance-crew.service";
import * as emergencyService from "../services/emergency.service";
import * as callService from "../services/call.service";
import * as hospitalService from "../services/hospital.service";
import { buildEmergencyView } from "../services/emergency-view.service";
import { successResponse } from "../utils/api-response";

// --------------------------------------------------------------------------
// Profile & dispatch state
// --------------------------------------------------------------------------

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ambulance = await crewService.getProfile(req.auth!.subjectId);
    res.status(200).json(successResponse(ambulance, "Profile retrieved"));
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
    const ambulance = await crewService.saveProfile(req.auth!.subjectId, req.body);
    res.status(200).json(successResponse(ambulance, "Profile saved"));
  } catch (error) {
    next(error);
  }
}

/** PATCH /ambulance/me/dispatch-status — the real ONLINE/OFFLINE toggle. */
export async function setDispatchStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { isOnline, latitude, longitude } = req.body;
    const ambulance = await crewService.setOnlineStatus(
      req.auth!.subjectId,
      isOnline,
      latitude !== undefined && longitude !== undefined
        ? { latitude, longitude }
        : undefined
    );
    res
      .status(200)
      .json(
        successResponse(
          ambulance,
          ambulance.isOnline
            ? "You are ONLINE and eligible for dispatch"
            : "You are OFFLINE and will not receive emergencies"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function updateLocation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ambulance = await crewService.updateLocation(
      req.auth!.subjectId,
      req.body.latitude,
      req.body.longitude
    );
    res.status(200).json(successResponse(ambulance, "Location updated"));
  } catch (error) {
    next(error);
  }
}

// --------------------------------------------------------------------------
// Active emergency
// --------------------------------------------------------------------------

export async function getActiveEmergency(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emergency = await crewService.findActiveEmergencyForAmbulance(
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

// --------------------------------------------------------------------------
// Lifecycle actions
// --------------------------------------------------------------------------

/**
 * Advances the emergency through a crew-owned transition. The transition map
 * is the authority on legality — this only checks ownership first.
 */
async function advance(
  req: Request<{ id: string }>,
  status: EmergencyStatus,
  description: string,
  extra: Record<string, unknown> = {}
) {
  const emergencyId = req.params.id;
  await crewService.assertAssignedTo(req.auth!.subjectId, emergencyId);
  return emergencyService.updateEmergencyStatus(emergencyId, {
    status,
    description,
    ...extra,
  });
}

/** Crew starts driving. This is also what kicks off hospital coordination. */
export async function startEnRoute(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emergency = await advance(
      req,
      EmergencyStatus.AMBULANCE_EN_ROUTE,
      "Crew dispatched — en route to patient"
    );
    res
      .status(200)
      .json(successResponse(buildEmergencyView(emergency), "En route to patient"));
  } catch (error) {
    next(error);
  }
}

/** Patient is onboard. This stamps the hospital lock. */
export async function pickUpPatient(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emergency = await advance(
      req,
      EmergencyStatus.PATIENT_PICKED_UP,
      "Patient onboard"
    );
    res
      .status(200)
      .json(
        successResponse(
          buildEmergencyView(emergency),
          "Patient picked up — hospital destination locked"
        )
      );
  } catch (error) {
    next(error);
  }
}

/** Medic's manual triage call. Not AI, not derived — a human decision. */
export async function selectSeverity(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emergency = await advance(
      req,
      EmergencyStatus.SEVERITY_SELECTED,
      `Severity assessed as ${req.body.severity}`,
      { severity: req.body.severity }
    );
    res
      .status(200)
      .json(successResponse(buildEmergencyView(emergency), "Severity recorded"));
  } catch (error) {
    next(error);
  }
}

export async function enRouteToHospital(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emergency = await advance(
      req,
      EmergencyStatus.EN_ROUTE_TO_HOSPITAL,
      "En route to hospital"
    );
    res
      .status(200)
      .json(successResponse(buildEmergencyView(emergency), "En route to hospital"));
  } catch (error) {
    next(error);
  }
}

export async function markArrived(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emergency = await advance(
      req,
      EmergencyStatus.ARRIVED,
      "Arrived at hospital"
    );
    // Terminal — hand the unit back to the dispatch pool.
    await crewService.releaseIfFree(req.auth!.subjectId);
    res
      .status(200)
      .json(successResponse(buildEmergencyView(emergency), "Arrived at hospital"));
  } catch (error) {
    next(error);
  }
}

// --------------------------------------------------------------------------
// Call & hospital notification
// --------------------------------------------------------------------------

export async function startCall(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await crewService.assertAssignedTo(req.auth!.subjectId, req.params.id);
    const emergency = await callService.startCall(req.params.id);
    res
      .status(200)
      .json(
        successResponse(
          buildEmergencyView(emergency),
          "Call connected (simulated)"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function endCall(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await crewService.assertAssignedTo(req.auth!.subjectId, req.params.id);
    const emergency = await callService.endCall(req.params.id);
    res
      .status(200)
      .json(successResponse(buildEmergencyView(emergency), "Call ended"));
  } catch (error) {
    next(error);
  }
}

/** Sends the emergency package to the locked hospital and advances status. */
export async function notifyHospital(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await crewService.assertAssignedTo(req.auth!.subjectId, req.params.id);
    const emergency = await hospitalService.notifyAssignedHospital(req.params.id);
    res
      .status(200)
      .json(successResponse(buildEmergencyView(emergency), "Hospital notified"));
  } catch (error) {
    next(error);
  }
}
